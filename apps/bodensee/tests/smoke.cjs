#!/usr/bin/env node
/* Smoke test for Die große Bodensee-Expedition.
 *
 *   node tests/smoke.cjs --dir public            # local build, served with the production headers
 *   node tests/smoke.cjs --url https://bodensee.malelu.io
 *
 *   node tests/smoke.cjs --url http://127.0.0.1:8080/ --allow-http   # the built container
 *
 * Options: --only devices,speech,voice,fullscreen,trips,languages,name (run parts), --timeout <ms> (slow machines),
 *          --shots <dir> (screenshots), --quick (fewer devices), --full (complete play-through on every device)
 * Exit code 0 = all checks passed.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const has = (name) => args.includes(name);
const ROOT = path.join(__dirname, '..');
const shotsDir = opt('--shots', path.join(ROOT, 'tests', 'screenshots'));
fs.mkdirSync(shotsDir, { recursive: true });

// ---------------------------------------------------------------- local server with nginx headers
function nginxHeaders() {
  const conf = fs.readFileSync(path.join(ROOT, 'nginx', 'security-headers.conf'), 'utf8');
  const out = {};
  for (const m of conf.matchAll(/add_header\s+([A-Za-z-]+)\s+"([^"]+)"/g)) out[m[1]] = m[2];
  return out;
}
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain',
};
function serve(dir) {
  const headers = nginxHeaders();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    for (const [k, v] of Object.entries(headers)) if (k !== 'Strict-Transport-Security') res.setHeader(k, v);
    if (url.pathname === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end('{"status":"ok","app":"bodensee","version":"local"}\n');
      return;
    }
    let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (p === '' || p.endsWith('/')) p += 'index.html';
    const file = path.join(dir, p);
    if (!file.startsWith(path.resolve(dir)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ---------------------------------------------------------------- helpers
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function touch(page, cdp, type, points) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map(([x, y], i) => ({ x, y, id: i, radiusX: 8, radiusY: 8, force: 1 })),
  });
}

async function yellowPixelsNear(page, x, y) {
  const buf = await page.screenshot({ clip: { x: Math.max(0, x - 60), y: Math.max(0, y - 50), width: 120, height: 100 } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 150 && d[i + 2] < 110) n++;
    return n;
  }, buf.toString('base64'));
}

// Poll with page.evaluate (runs over CDP). page.waitForFunction would need 'unsafe-eval', which
// the production CSP rightly forbids (Playwright <= 1.49 then throws an EvalError immediately).
async function waitFor(page, fn, timeout = 8000, arg) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await page.evaluate(fn, arg).catch(() => false)) return true;
    await sleep(100);
  }
  return false;
}

async function state(page) {
  return page.evaluate(() => ({ mode: window.__bodensee.mode, found: window.__bodensee.found, sub: window.__bodensee.sub }));
}

async function clickUntil(page, selector, predicate, tries = 12) {
  for (let i = 0; i < tries; i++) {
    if (await predicate()) return true;
    await page.click(selector);
    await sleep(250);
  }
  return predicate();
}

// ---------------------------------------------------------------- one device run
async function runDevice(browser, base, label, ctxOpts, full) {
  console.log(`\n▶ ${label}`);
  const context = await browser.newContext({ ...ctxOpts, serviceWorkers: 'block' });
  const page = await context.newPage();
  // Stand-in speech engine: headless Chromium has no voices, and the checks must see what would be spoken.
  await page.addInitScript(() => {
    // Fullscreen has its own checks below; here a refusal keeps the page size of the emulated device.
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('stand-in'));
    window.__spoken = [];
    let current = null;
    window.speechSynthesis.speak = (u) => {
      window.__spoken.push(u.text);
      current = u;
    };
    window.speechSynthesis.cancel = () => { current = null; };
    // A part stays "spoken" until the check ends it, so slow machines cannot change the outcome.
    window.__speechEnd = () => {
      const u = current;
      current = null;
      if (u && u.onend) u.onend({});
      return !!u;
    };
  });
  const spoken = () => page.evaluate(() => window.__spoken.join(' '));
  const pressed = (sel) => page.getAttribute(sel, 'aria-pressed');
  const errors = [];
  const foreign = [];
  const origin = new URL(base).origin;
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith('data:') && !u.startsWith('blob:') && new URL(u).origin !== origin) foreign.push(u);
  });
  const resp = await page.goto(base, { waitUntil: 'load' });
  check(`${label}: page loads (HTTP ${resp.status()})`, resp.ok());
  if (!(await waitFor(page, () => !!window.__bodensee && window.__bodensee.mode === 'title'))) throw new Error('game did not reach the title screen');
  await sleep(600);
  const vp = page.viewportSize();
  const tag = label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  await page.screenshot({ path: path.join(shotsDir, `${tag}-1-title.png`) });

  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check(`${label}: no horizontal scrolling`, noHScroll);

  // start + intro dialog
  await page.click('#btnStart');
  await waitFor(page, () => window.__bodensee.mode === 'dialog', 5000);
  await sleep(300);
  await page.screenshot({ path: path.join(shotsDir, `${tag}-2-intro.png`) });

  // read aloud: intro message, next page follows, second tap stops
  const silentStart = (await spoken()) === '';
  await page.click('#btnDialogSpeak');
  const introSpoken = await spoken();
  check(`${label}: speaker button reads the radio message aloud`, silentStart && introSpoken.includes('Leo Eins') && !introSpoken.includes('LEO 1') && (await pressed('#btnDialogSpeak')) === 'true', introSpoken.slice(0, 50));
  await page.screenshot({ path: path.join(shotsDir, `${tag}-2b-intro-reading.png`) });
  await page.evaluate(() => window.__speechEnd());
  check(`${label}: button returns to rest when the text is finished`, (await pressed('#btnDialogSpeak')) === 'false');
  await clickUntil(page, '#btnDialogNext', async () => (await spoken()).includes('Sturm'), 6);
  check(`${label}: next radio page is read on`, (await spoken()).includes('Sturm') && (await pressed('#btnDialogSpeak')) === 'true');
  await page.click('#btnDialogSpeak');
  const stoppedAt = await spoken();
  const stoppedPressed = await pressed('#btnDialogSpeak');
  await page.click('#btnDialogNext');
  await sleep(100);
  await page.click('#btnDialogNext');
  await sleep(100);
  check(`${label}: second tap stops reading and the next page stays silent`, stoppedPressed === 'false' && (await spoken()) === stoppedAt);
  const reachedPlay = await clickUntil(page, '#btnDialogNext', async () => (await state(page)).mode === 'play', 14);
  check(`${label}: intro dialog leads into the game`, reachedPlay);
  await sleep(500);

  // submarine visible right from the start
  const s0 = await state(page);
  const sp = await page.evaluate(({ x, y }) => window.__bodensee.worldToScreen(x, y), s0.sub);
  const inView = sp.x > 0 && sp.x < vp.width && sp.y > 0 && sp.y < vp.height;
  const yellow = await yellowPixelsNear(page, sp.x, sp.y);
  check(`${label}: yellow submarine visible at start`, inView && yellow > 150, `screen ${Math.round(sp.x)},${Math.round(sp.y)}, ${yellow} yellow px`);

  // HUD buttons inside the viewport and large enough for fingers
  const btns = await page.evaluate(() => [...document.querySelectorAll('#hud button')].filter((b) => b.offsetParent).map((b) => {
    const r = b.getBoundingClientRect();
    return { id: b.id, x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
  }));
  const badBtn = btns.filter((b) => b.x < 0 || b.y < 0 || b.r > vp.width + 0.5 || b.b > vp.height + 0.5 || Math.min(b.w, b.h) < 44);
  check(`${label}: HUD buttons on screen and ≥ 44 px`, badBtn.length === 0, badBtn.map((b) => `${b.id} ${Math.round(b.w)}x${Math.round(b.h)}`).join(', '));

  // touch: press and hold below-right of the sub -> sub moves there
  const cdp = await context.newCDPSession(page);
  const target = [Math.min(vp.width - 30, sp.x + vp.width * 0.3), Math.min(vp.height - 140, sp.y + vp.height * 0.22)];
  await touch(page, cdp, 'touchStart', [target]);
  await sleep(1400);
  const mid = await state(page);
  await touch(page, cdp, 'touchEnd', []);
  check(`${label}: press-and-hold steers the submarine`, mid.sub.x > s0.sub.x + 40 && mid.sub.y > s0.sub.y + 15, `Δx=${Math.round(mid.sub.x - s0.sub.x)} Δy=${Math.round(mid.sub.y - s0.sub.y)}`);

  // drag while holding: moving the finger to the left turns the sub around
  const p1 = await state(page);
  await touch(page, cdp, 'touchStart', [[vp.width * 0.6, vp.height * 0.5]]);
  for (let i = 1; i <= 8; i++) {
    await touch(page, cdp, 'touchMove', [[vp.width * 0.6 - i * (vp.width * 0.06), vp.height * 0.5]]);
    await sleep(70);
  }
  await sleep(1300);
  const p2 = await state(page);
  await touch(page, cdp, 'touchEnd', []);
  check(`${label}: dragging the finger re-targets the submarine`, p2.sub.x < p1.sub.x + 10 && p2.sub.vx < 0, `vx=${Math.round(p2.sub.vx)}`);

  // pause / resume
  await page.click('#btnPause');
  const paused = (await state(page)).mode === 'pause';
  await sleep(200);
  await page.screenshot({ path: path.join(shotsDir, `${tag}-4-pause.png`) });
  // joystick mode via the pause menu
  await page.click('#pause .seg[data-control="stick"]');
  await page.click('#btnResume');
  const resumed = (await state(page)).mode === 'play';
  check(`${label}: pause and resume buttons work`, paused && resumed);
  const j0 = await state(page);
  const o = [vp.width * 0.5, vp.height * 0.45];
  await touch(page, cdp, 'touchStart', [o]);
  for (let i = 1; i <= 6; i++) {
    await touch(page, cdp, 'touchMove', [[o[0] + i * 12, o[1] + i * 5]]);
    await sleep(40);
  }
  await sleep(1200);
  const j1 = await state(page);
  await touch(page, cdp, 'touchEnd', []);
  check(`${label}: joystick drag mode steers`, j1.sub.x > j0.sub.x + 40, `Δx=${Math.round(j1.sub.x - j0.sub.x)}`);
  await page.click('#btnPause');
  await page.click('#pause .seg[data-control="hold"]');
  await page.click('#btnResume');

  // light, ping, sound, logbook
  const l0 = (await state(page)).sub.light;
  await page.click('#btnLight');
  const l1 = (await state(page)).sub.light;
  await page.click('#btnLight');
  check(`${label}: light button toggles the headlight`, l0 !== l1);
  await page.click('#btnPing');
  await sleep(200);
  const pingShown = await page.evaluate(() => !document.getElementById('pingHint').hidden) && (await page.isVisible('#pingArrow'));
  check(`${label}: sonar ping shows the direction arrow`, pingShown);
  const snd0 = await page.getAttribute('#btnSound', 'aria-pressed');
  await page.click('#btnSound');
  const snd1 = await page.getAttribute('#btnSound', 'aria-pressed');
  await page.click('#btnSound');
  check(`${label}: sound button toggles`, snd0 !== snd1);
  await page.click('#btnLog');
  const logOpen = (await state(page)).mode === 'logbook' && (await page.isVisible('#logSites'));
  await page.click('#tabFish');
  const fishTab = await page.isVisible('#logFish');
  await page.click('#btnLogClose');
  check(`${label}: logbook opens, tabs switch, closes`, logOpen && fishTab && (await state(page)).mode === 'play');

  // discover the first site
  const sites = await page.evaluate(() => window.__bodensee.sites);
  await page.evaluate((s) => window.__bodensee.teleport(s.x - 20, s.y), sites[0]);
  await page.screenshot({ path: path.join(shotsDir, `${tag}-3-play.png`) });
  await waitFor(page, () => window.__bodensee.mode === 'card', 10000);
  const afterFind = await state(page);
  check(`${label}: approaching a logbook page opens the discovery card`, afterFind.mode === 'card' && afterFind.found.length === 1, `mode=${afterFind.mode} found=${afterFind.found.length}`);
  await sleep(700);
  await page.screenshot({ path: path.join(shotsDir, `${tag}-5-card.png`) });
  const title = await page.textContent('#cardTitle');
  await page.click('#btnCardSpeak');
  const cardSpoken = await spoken();
  const cardPressed = await pressed('#btnCardSpeak');
  check(`${label}: logbook page is read aloud with its title and facts`, cardSpoken.includes(title) && cardPressed === 'true', title);
  const cardFits = await page.evaluate(() => {
    const r = document.querySelector('#card .card').getBoundingClientRect();
    return r.left >= -1 && r.right <= window.innerWidth + 1;
  });
  check(`${label}: discovery card fits the screen width`, cardFits);
  await page.click('#btnCardClose');
  check(`${label}: closing the page stops reading`, (await pressed('#btnCardSpeak')) === 'false');

  // read aloud: radio bubble in the game; the tap must not skip the message
  await page.evaluate(() => window.__bodensee.say('Prüfung des Vorlesens im Funk.'));
  await waitFor(page, () => !document.getElementById('radio').hidden, 12000);
  const radioBox = await page.evaluate(() => {
    const r = document.getElementById('btnRadioSpeak').getBoundingClientRect();
    return { x: r.left, r: r.right, w: r.width, h: r.height };
  });
  check(`${label}: radio speaker button on screen and ≥ 44 px`, radioBox.x >= 0 && radioBox.r <= vp.width + 0.5 && Math.min(radioBox.w, radioBox.h) >= 44);
  const beforeRadio = (await spoken()).length;
  await page.click('#btnRadioSpeak');
  await sleep(150);
  await page.screenshot({ path: path.join(shotsDir, `${tag}-5b-radio.png`) });
  check(`${label}: radio bubble is read aloud and stays open`, (await spoken()).length > beforeRadio && await page.isVisible('#radio'));
  await page.click('#btnRadioSpeak');

  // read aloud: fish book
  await page.evaluate(() => window.__bodensee.see());
  await page.click('#btnLog');
  await page.click('#tabFish');
  const beforeFish = (await spoken()).length;
  await page.click('#logFish .speak-btn');
  const fishText = (await spoken()).slice(beforeFish);
  await page.screenshot({ path: path.join(shotsDir, `${tag}-5c-fish.png`) });
  check(`${label}: fish book entry is read aloud`, fishText.length > 20, fishText.slice(0, 50));
  await page.click('#btnLogClose');

  if (full) {
    for (const s of sites.slice(1)) {
      await page.evaluate((p) => window.__bodensee.teleport(p.x - 20, p.y), s);
      await waitFor(page, () => window.__bodensee.mode === 'card', 10000);
      await sleep(300);
      if (s.id === 'jura') await page.screenshot({ path: path.join(shotsDir, `${tag}-6-jura-card.png`) });
      await page.click('#btnCardClose');
    }
    const finale = await clickUntil(page, '#btnDialogNext', async () => (await state(page)).mode === 'ending', 12);
    check(`${label}: all five discoveries lead to the certificate`, finale);
    await page.click('#btnEndSpeak');
    check(`${label}: certificate is read aloud`, (await spoken()).includes('Ehren-Seeforscher'));
    await page.click('#btnEndSpeak');
    await sleep(800);
    await page.screenshot({ path: path.join(shotsDir, `${tag}-7-certificate.png`) });
    await page.click('#btnRoam');
    await page.evaluate(() => window.__bodensee.teleport(6230, 1290));
    await sleep(1600);
    await page.screenshot({ path: path.join(shotsDir, `${tag}-8-jura-wreck.png`) });
    await page.evaluate(() => window.__bodensee.teleport(4560, 1010));
    await sleep(1600);
    await page.screenshot({ path: path.join(shotsDir, `${tag}-9-wels.png`) });
  }

  // restart resets the discoveries
  await page.click('#btnPause');
  await page.click('#btnRestart');
  await page.click('#btnConfirmYes');
  await sleep(300);
  const reset = await state(page);
  const pagesFound = await page.$$eval('#pageRow .pg.found', (els) => els.length);
  check(`${label}: restart resets the found pages`, reset.mode === 'play' && reset.found.length === 0 && pagesFound === 0);

  await sleep(400);
  check(`${label}: no JavaScript errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  check(`${label}: no third-party requests`, foreign.length === 0, foreign.slice(0, 3).join(', '));
  await context.close();
}

// ---------------------------------------------------------------- read aloud is hidden when it cannot stay on the device
async function speechFallback(browser, base) {
  console.log('\n▶ Vorlesen ohne Gerätestimme');
  const cases = [
    ['no speech engine', () => Object.defineProperty(window, 'speechSynthesis', { value: undefined })],
    ['German network voice only', () => { window.speechSynthesis.getVoices = () => [{ lang: 'de-DE', name: 'Netz', localService: false }]; }],
    ['English voice only', () => { window.speechSynthesis.getVoices = () => [{ lang: 'en-US', name: 'Local', localService: true }]; }],
  ];
  for (const [name, setup] of cases) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.addInitScript(setup);
    await page.goto(base, { waitUntil: 'load' });
    await waitFor(page, () => !!window.__bodensee && window.__bodensee.mode === 'title');
    await page.click('#btnStart');
    await waitFor(page, () => window.__bodensee.mode === 'dialog', 5000);
    check(`${name}: speaker button hidden`, !(await page.isVisible('#btnDialogSpeak')));
    await context.close();
  }
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.speechSynthesis.getVoices = () => [{ lang: 'de_DE', name: 'Lokal', localService: true }];
  });
  await page.goto(base, { waitUntil: 'load' });
  await waitFor(page, () => !!window.__bodensee && window.__bodensee.mode === 'title');
  await page.click('#btnStart');
  await waitFor(page, () => window.__bodensee.mode === 'dialog', 5000);
  check('German on-device voice: speaker button shown', await page.isVisible('#btnDialogSpeak'));
  await context.close();
}

// ---------------------------------------------------------------- reading stays in one piece, with the best voice on the device
async function speechFlow(browser, base) {
  console.log('\n▶ Vorlesen flüssig');
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__parts = [];
    // The real SpeechSynthesisUtterance only accepts real SpeechSynthesisVoice objects; with the plain
    // stand-in voices below, setting u.voice would throw and nothing would be spoken at all.
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
        this.voice = null;
        this.lang = '';
        this.rate = 1;
        this.pitch = 1;
      }
    };
    window.speechSynthesis.getVoices = () => [
      { lang: 'de-AT', name: 'Michael', localService: true },
      { lang: 'de-DE', name: 'Grandma (Deutsch (Deutschland))', localService: true },
      { lang: 'de-DE', name: 'Anna (Enhanced)', localService: true },
      { lang: 'de-DE', name: 'Online (Natural)', localService: false },
    ];
    window.speechSynthesis.speak = (u) => window.__parts.push({ text: u.text, voice: u.voice && u.voice.name, rate: u.rate, pitch: u.pitch });
    window.speechSynthesis.cancel = () => {};
  });
  await page.goto(base, { waitUntil: 'load' });
  await waitFor(page, () => !!window.__bodensee && window.__bodensee.mode === 'title');
  await page.click('#btnStart');
  await waitFor(page, () => window.__bodensee.mode === 'dialog', 5000);
  await page.click('#btnDialogSpeak');
  const parts = () => page.evaluate(() => window.__parts);
  await clickUntil(page, '#btnDialogNext', async () => (await parts()).some((p) => p.text.includes('Dampfschiff')), 10);
  const list = await parts();
  const longest = list.find((p) => p.text.includes('Dampfschiff'));
  check('a long radio page is one utterance', !!longest && longest.text.startsWith('Jede Seite'), longest && longest.text.slice(0, 40));
  check('the better on-device voice is chosen', list.length > 0 && list.every((p) => p.voice === 'Anna (Enhanced)'), list[0] && list[0].voice);
  check('rate 1 and a friendly pitch', list.length > 0 && list.every((p) => p.rate === 1 && p.pitch > 1 && p.pitch <= 1.2));
  await context.close();
}

// ---------------------------------------------------------------- fullscreen: on start, back after Esc, left on request, never needed
// Stand-in API: headless Chromium cannot show what a real device does, so these checks cover the logic only.
async function fullscreenChecks(browser, base) {
  console.log('\n▶ Vollbild');
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    let el = null;
    const changed = () => document.dispatchEvent(new Event('fullscreenchange'));
    window.__fsCalls = 0;
    Object.defineProperty(document, 'fullscreenEnabled', { get: () => true });
    Object.defineProperty(document, 'fullscreenElement', { get: () => el });
    Element.prototype.requestFullscreen = function () {
      window.__fsCalls++;
      el = this;
      changed();
      return Promise.resolve();
    };
    document.exitFullscreen = () => {
      el = null;
      changed();
      return Promise.resolve();
    };
    window.__fsLost = () => {
      el = null;
      changed();
    };
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const calls = () => page.evaluate(() => window.__fsCalls);
  const label = () => page.textContent('#btnFullscreen');
  await page.goto(base, { waitUntil: 'load' });
  await waitFor(page, () => !!window.__bodensee && window.__bodensee.mode === 'title');
  check('credit line on the title screen', (await page.textContent('.credit')).includes('MALELU AI') && (await page.isVisible('.credit')));
  await page.click('#btnStart');
  await waitFor(page, () => window.__bodensee.mode === 'dialog', 5000);
  check('start asks for fullscreen', (await calls()) === 1);
  await clickUntil(page, '#btnDialogNext', async () => (await state(page)).mode === 'play', 16);
  check('still one request after the intro', (await calls()) === 1);
  await page.evaluate(() => window.__fsLost());
  await sleep(100);
  check('leaving fullscreen during play pauses', (await state(page)).mode === 'pause' && (await page.isVisible('#btnFullscreen')) && (await label()) === 'Vollbild einschalten');
  await page.click('#btnResume');
  await sleep(100);
  check('resume returns to fullscreen', (await state(page)).mode === 'play' && (await calls()) === 2);
  await page.click('#btnPause');
  await sleep(100);
  check('fullscreen stays during pause', (await label()) === 'Vollbild beenden');
  await page.click('#btnFullscreen');
  await sleep(100);
  await page.click('#btnResume');
  await sleep(100);
  check('left by button: resume stays in the window', (await state(page)).mode === 'play' && (await calls()) === 2);
  check('no script errors with fullscreen', errors.length === 0, errors.join(' | '));
  await context.close();

  const without = await browser.newContext({ serviceWorkers: 'block' });
  const plain = await without.newPage();
  await plain.addInitScript(() => {
    delete Element.prototype.requestFullscreen;
    delete Element.prototype.webkitRequestFullscreen;
  });
  const plainErrors = [];
  plain.on('pageerror', (e) => plainErrors.push(e.message));
  await plain.goto(base, { waitUntil: 'load' });
  await waitFor(plain, () => !!window.__bodensee && window.__bodensee.mode === 'title');
  await plain.click('#btnStart');
  const started = await waitFor(plain, () => window.__bodensee.mode === 'dialog', 5000);
  check('without fullscreen API (iPhone): game starts, no errors', started && plainErrors.length === 0, plainErrors.join(' | '));
  await clickUntil(plain, '#btnDialogNext', async () => (await state(plain)).mode === 'play', 16);
  await plain.click('#btnPause');
  await sleep(100);
  check('without fullscreen API: no button in the pause menu', !(await plain.isVisible('#btnFullscreen')));
  await without.close();
}

// ---------------------------------------------------------------- trips: map, shore path, time travel, fossil dig
async function tripChecks(browser, base) {
  console.log('\n▶ Ausflüge');
  const context = await browser.newContext({ viewport: { width: 1024, height: 700 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.reject(new Error('stand-in')); });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base, { waitUntil: 'load' });
  await waitFor(page, () => !!window.__bodensee && window.__bodensee.mode === 'title');
  const gaps = await page.evaluate(() => {
    const BE = window.__bodensee.ext;
    const out = [];
    for (const stop of BE.shore) {
      if (!BE.places.find((p) => p.id === stop.place)) out.push(`place ${stop.place}`);
      for (const id of stop.spots) {
        const it = BE.item(id);
        if (!it) { out.push(`item ${id}`); continue; }
        if (it.draw && !BE.landmarks[it.draw] && !BE.miniDraw[it.draw]) out.push(`draw ${it.draw}`);
        if (it.critter && !BE.critters[it.critter]) out.push(`critter ${it.critter}`);
      }
    }
    for (const e of BE.eras) {
      if (!BE.eraArt[e.id]) { out.push(`era ${e.id}`); continue; }
      for (const key of Object.keys(e.creatures)) if (!BE.eraArt[e.id].creatures[key]) out.push(`creature ${e.id}.${key}`);
    }
    return out;
  });
  check('every spot, place, era and creature has its data and drawing', gaps.length === 0, gaps.join(', '));
  const paintErrors = await page.evaluate(() => {
    const BE = window.__bodensee.ext;
    const cv = document.createElement('canvas');
    cv.width = 640;
    cv.height = 400;
    const c = cv.getContext('2d');
    const out = [];
    const tryDraw = (name, fn) => { try { c.save(); fn(); c.restore(); } catch (e) { out.push(`${name}: ${e.message}`); } };
    for (const [k, fn] of [...Object.entries(BE.landmarks), ...Object.entries(BE.critters), ...Object.entries(BE.miniDraw)]) tryDraw(k, () => fn(c, 1.5));
    for (const [k, era] of Object.entries(BE.eraArt)) {
      tryDraw(k, () => era.back(c, 640, 400, 1.5));
      for (const [id, d] of Object.entries(era.creatures)) tryDraw(`${k}.${id}`, () => d.draw(c, 1.5, 2));
    }
    return out;
  });
  check('all drawings paint without errors', paintErrors.length === 0, paintErrors.slice(0, 4).join(' | '));
  await page.click('#btnStart');
  await waitFor(page, () => window.__bodensee.mode === 'dialog', 5000);
  await clickUntil(page, '#btnDialogNext', async () => (await state(page)).mode === 'play', 16);
  await page.click('#btnMap');
  check('map button opens the trips', (await state(page)).mode === 'ausflug' && (await page.isVisible('#extCanvas')) && !(await page.isVisible('#hud')));
  await page.click('.ext-nav button[data-view="ufer"]');
  await sleep(200);
  const x0 = await page.evaluate(() => window.__bodensee.ext.views.ufer.debug.x);
  await page.mouse.move(900, 450);
  await page.mouse.down();
  await sleep(1500);
  await page.mouse.up();
  const x1 = await page.evaluate(() => window.__bodensee.ext.views.ufer.debug.x);
  check('holding right of the child walks along the shore', x1 > x0 + 60, `${x0} -> ${x1}`);
  await page.evaluate(() => window.__bodensee.ext.show('ufer', 'lindau'));
  await page.mouse.move(900, 450);
  await page.mouse.down();
  const stamped = await waitFor(page, () => window.__bodensee.ext.has('ort-lindau'), 5000);
  await page.mouse.up();
  check('walking past a sign stamps the place', stamped);
  await page.evaluate(() => window.__bodensee.ext.info('lm-zeppelin'));
  check('info card shows title and facts', (await page.textContent('#extInfoTitle')).includes('Luftschiff') && (await page.locator('#extInfoFacts li').count()) >= 1);
  await page.click('#extInfoClose');
  await page.click('.ext-nav button[data-view="zeit"]');
  await sleep(200);
  const era0 = await page.evaluate(() => window.__bodensee.ext.views.zeit.debug.era);
  await page.keyboard.press('ArrowRight');
  await sleep(1300);
  const era1 = await page.evaluate(() => window.__bodensee.ext.views.zeit.debug.era);
  check('time travel moves to the next era', era0 !== era1, `${era0} -> ${era1}`);
  await page.evaluate(() => window.__bodensee.ext.show('grabung'));
  await sleep(100);
  await page.mouse.move(250, 200);
  await page.mouse.down();
  for (let y = 180; y < 620; y += 26) {
    await page.mouse.move(120, y, { steps: 3 });
    await page.mouse.move(900, y + 13, { steps: 3 });
  }
  await page.mouse.up();
  const dug = await waitFor(page, () => !document.getElementById('extInfo').hidden, 4000);
  check('brushing the stone reveals a fossil', dug && (await page.evaluate(() => window.__bodensee.ext.has('fund-salamander'))));
  await page.click('#extInfoClose');
  await page.click('#extBookBtn');
  check('Forscherbuch lists the finds', (await page.locator('#extBookGrid .book-item.got').count()) >= 1);
  await page.click('#extBookClose');
  await page.click('#extBack');
  check('back button returns to the submarine', (await state(page)).mode === 'play');
  await page.reload({ waitUntil: 'load' });
  await waitFor(page, () => !!window.__bodensee && window.__bodensee.mode === 'title');
  check('the collection survives a reload', await page.evaluate(() => window.__bodensee.ext.has('ort-lindau')));
  check('no script errors on the trips', errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

// ---------------------------------------------------------------- languages: complete, same numbers, switch works, German stays the default
function literalKeys() {
  const dir = path.join(ROOT, 'src');
  const out = new Set(['Deutschland', 'Schweiz', 'Österreich', 'Bodensee', 'ganz nah', 'nah', 'mittel', 'weit']);
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.js') || f.startsWith('i18n-') || f === 'ext-landmarks.js' || f === 'ext-era-art.js') continue;
    const s = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of s.matchAll(/(?:\b_t|\b_tf|\bsay|\.toast|\btoast)\(([^\n]*)/g)) {
      for (const q of m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) {
        const v = q[1].replace(/\\'/g, "'");
        // The rest of the line can hold other arguments too, such as a colour value next to _t('Bodensee').
        if (/[A-Za-zÄÖÜäöü]{3}/.test(v) && !/^([a-z]+|#.*|[a-z]+[A-Z]\w*|(?:rgba?|hsla?)\(.*\))$/.test(v)) out.add(v);
      }
    }
    for (const m of s.matchAll(/label: '((?:[^'\\]|\\.)*)'/g)) out.add(m[1]);
  }
  return [...out];
}
async function languageChecks(browser, base) {
  console.log('\n▶ Sprachen');
  const context = await browser.newContext({ viewport: { width: 1024, height: 700 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'load' });
  await waitFor(page, () => !!window.__bodensee && window.__bodensee.mode === 'title');
  check('German is the default language', (await page.evaluate(() => document.documentElement.lang)) === 'de' && (await page.textContent('#btnStart')).includes('Expedition'));
  const runtime = await page.evaluate(() => window.__bodensee.i18nKeys());
  const keys = [...new Set([...runtime, ...literalKeys()])];
  const numbers = (s) => (s.replace(/(\d)[.,   ](?=\d{3}\b)/g, '$1').match(/\d+(?:[.,]\d+)?/g) || []).map((z) => z.replace(',', '.')).sort().join('|');
  for (const code of ['en', 'it', 'fr']) {
    const table = await page.evaluate((c) => Object.fromEntries(window.__bodensee.i18nKeys().map((k) => [k, window.__bodensee.i18n.value(c, k)])), code);
    const lit = await page.evaluate(([c, ks]) => Object.fromEntries(ks.map((k) => [k, window.__bodensee.i18n.value(c, k)])), [code, keys]);
    const all = { ...table, ...lit };
    const missing = keys.filter((k) => all[k] === undefined);
    check(`${code}: every text is translated`, missing.length === 0, missing.slice(0, 5).join(' | '));
    const wrong = keys.filter((k) => all[k] !== undefined && numbers(k) !== numbers(all[k]));
    check(`${code}: numbers match the German text`, wrong.length === 0, wrong.slice(0, 4).join(' | '));
    const holes = keys.filter((k) => all[k] !== undefined && ((k.match(/\{\w+\}/g) || []).sort().join() !== (all[k].match(/\{\w+\}/g) || []).sort().join()));
    check(`${code}: placeholders match`, holes.length === 0, holes.slice(0, 4).join(' | '));
  }
  await page.click('.lang-corner .lang-seg[data-lang="en"]');
  check('switching to English changes the page', (await page.evaluate(() => document.documentElement.lang)) === 'en' && !(await page.textContent('#btnStart')).includes('starten'));
  await page.reload({ waitUntil: 'load' });
  await waitFor(page, () => !!window.__bodensee && window.__bodensee.mode === 'title');
  check('the choice survives a reload', (await page.evaluate(() => document.documentElement.lang)) === 'en');
  await page.click('.lang-corner .lang-seg[data-lang="de"]');
  check('switching back restores German', (await page.textContent('#btnStart')).includes('Expedition') && (await page.evaluate(() => document.documentElement.lang)) === 'de');
  await context.close();
}

// ---------------------------------------------------------------- name on the title screen, certificate as a picture
async function nameChecks(browser, base) {
  console.log('\n▶ Name und Urkunde');
  const context = await browser.newContext({ viewport: { width: 1024, height: 700 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.reject(new Error('stand-in')); });
  await page.goto(base, { waitUntil: 'load' });
  await waitFor(page, () => !!window.__bodensee && window.__bodensee.mode === 'title');
  check('neutral title', (await page.textContent('#titleHead')).includes('Die große') && !(await page.textContent('#titleHead')).includes('Leopold'));
  await page.fill('#playerName', 'Mia <b>');
  await page.reload({ waitUntil: 'load' });
  await waitFor(page, () => !!window.__bodensee && window.__bodensee.mode === 'title');
  check('the name is kept, without markup', (await page.inputValue('#playerName')) === 'Mia b', await page.inputValue('#playerName'));
  await page.click('#btnStart');
  const greeted = await waitFor(page, () => document.getElementById('dialogText').textContent.includes('Kapitän Mia b'), 9000);
  check('the radio message greets the child by name', greeted);
  const size = await page.evaluate(async () => (await window.__bodensee.certificate()).size);
  check('the certificate picture is made', size > 20000, String(size));
  await context.close();
  const linked = await browser.newContext({ serviceWorkers: 'block' });
  const page2 = await linked.newPage();
  await page2.goto(`${base}?name=Leopold`, { waitUntil: 'load' });
  await waitFor(page2, () => !!window.__bodensee && window.__bodensee.mode === 'title');
  check('a family link fills in the name', (await page2.inputValue('#playerName')) === 'Leopold');
  await linked.close();
}

// ---------------------------------------------------------------- recorded narration first, the device voice only for the rest
function silentWav(seconds = 0.4, rate = 8000) {
  const n = Math.round(seconds * rate) * 2;
  const b = Buffer.alloc(44 + n);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n, 40);
  return b;
}
async function voiceChecks(browser, base) {
  console.log('\n▶ Aufgenommene Stimme');
  const context = await browser.newContext({ viewport: { width: 1024, height: 700 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('stand-in'));
    window.__deviceSpoken = 0;
    if (window.speechSynthesis) window.speechSynthesis.speak = () => { window.__deviceSpoken++; };
  });
  await page.goto(base, { waitUntil: 'load' });
  await waitFor(page, () => !!window.__bodensee && window.__bodensee.mode === 'title', 30000);
  check('no AI-voice label without recordings', !(await page.isVisible('.credit .voice-note')));
  const list = await page.evaluate(() => window.__bodensee.speech());
  const keys = new Set(list.map((t) => t.key));
  check('every text the reader can get is listed for recording', list.length > 250 && keys.size === list.length, `${list.length} texts`);
  check('listed texts carry no placeholder and no name', list.every((t) => !/[{}]/.test(t.text)));
  check('the spoken form says the boat name in words', list.every((t) => !/LEO 1/.test(t.spoken)));
  // Stand-in recordings: an index with every German key and a short silent WAV behind each file name.
  const served = [];
  const wav = silentWav();
  await context.route('**/audio/index.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ set: 'test', keys: { de: [...keys] } }) }));
  await context.route('**/audio/test/**', (r) => {
    served.push(new URL(r.request().url()).pathname);
    r.fulfill({ contentType: 'audio/wav', body: wav });
  });
  await page.goto(`${base}?name=Mia`, { waitUntil: 'load' });
  await waitFor(page, () => !!window.__bodensee && window.__bodensee.mode === 'title' && window.__bodensee.reading.recorded, 30000);
  check('the AI voice is labelled', await page.isVisible('.credit .voice-note'));
  await page.click('#btnStart');
  await waitFor(page, () => window.__bodensee.mode === 'dialog', 30000);
  await page.click('#btnDialogSpeak');
  const first = list[0].key;
  const playing = await waitFor(page, (k) => window.__bodensee.reading.via === 'audio' && window.__bodensee.reading.src.endsWith(`/de/${k}.mp3`), 10000, first);
  check('the greeting with the child\'s name plays the recording made without it', playing, await page.evaluate(() => JSON.stringify(window.__bodensee.reading)));
  const ended = await waitFor(page, () => window.__bodensee.reading.via === null, 15000);
  check('the button is released when the recording ends', ended && (await page.getAttribute('#btnDialogSpeak', 'aria-pressed')) === 'false');
  await clickUntil(page, '#btnDialogNext', async () => (await page.evaluate(() => window.__bodensee.mode)) === 'play', 14);
  await waitFor(page, () => !document.getElementById('radio').hidden, 30000);
  await page.click('#btnRadioSpeak');
  const radio = await waitFor(page, () => window.__bodensee.reading.via === 'audio', 10000);
  check('a radio message plays its recording', radio, await page.textContent('#radioText'));
  check('the recordings come from our own server', served.length >= 2 && served.every((p) => /^\/audio\/test\/de\/[0-9a-f]{8}\.mp3$/.test(p)), served.join(' '));
  check('no device voice was needed', (await page.evaluate(() => window.__deviceSpoken)) === 0);
  await context.close();
}

// ---------------------------------------------------------------- remote-only checks
async function remoteChecks(base) {
  console.log(`\n▶ HTTP checks ${base}`);
  const u = new URL(base);
  if (!has('--allow-http')) check('URL uses HTTPS', u.protocol === 'https:');
  const health = await fetch(new URL('/health', base));
  let body = {};
  try { body = await health.json(); } catch (e) { /* keep empty */ }
  check('health check /health answers ok', health.ok && body.status === 'ok', JSON.stringify(body));
  const index = await fetch(base);
  const csp = index.headers.get('content-security-policy') || '';
  check('Content-Security-Policy header present', csp.includes("default-src 'self'"));
  check('HSTS header present', !!index.headers.get('strict-transport-security'));
  const html = await index.text();
  const external = [...html.matchAll(/(?:src|href)="(https?:)?\/\/[^"]+"/g)].map((m) => m[0]);
  check('page references no external hosts', external.length === 0, external.join(', '));
}

(async () => {
  let server = null;
  let base = opt('--url', null);
  if (!base) {
    const dir = path.resolve(opt('--dir', path.join(ROOT, 'public')));
    server = await serve(dir);
    base = `http://127.0.0.1:${server.address().port}/`;
  } else {
    await remoteChecks(base);
  }
  const browser = await chromium.launch(process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : {});
  const parts = opt('--only', 'devices,speech,voice,fullscreen,trips,languages,name').split(',');
  const timeout = Number(opt('--timeout', 30000));
  const plainContext = browser.newContext.bind(browser);
  browser.newContext = async (o) => {
    const c = await plainContext(o);
    c.setDefaultTimeout(timeout);
    c.setDefaultNavigationTimeout(timeout);
    return c;
  };
  const runs = [
    ['iPhone 13 hochkant', devices['iPhone 13']],
    ['iPhone 13 quer', devices['iPhone 13 landscape']],
    ['iPad hochkant', devices['iPad (gen 7)']],
    ['iPad quer', devices['iPad (gen 7) landscape']],
    ['Desktop', { viewport: { width: 1280, height: 800 }, hasTouch: true, deviceScaleFactor: 1 }],
  ];
  const all = has('--quick') ? [runs[0], runs[2]] : runs;
  const list = parts.includes('devices') ? all : [];
  for (const [label, ctx] of list) {
    try {
      await runDevice(browser, base, label, ctx, has('--full') || label === 'iPad quer' || label === 'iPhone 13 quer');
    } catch (e) {
      check(`${label}: run completed`, false, e.message.split('\n').slice(0, 3).join(' '));
    }
  }
  if (parts.includes('speech')) try {
    await speechFallback(browser, base);
  } catch (e) {
    check('speech fallback run completed', false, e.message.split('\n')[0]);
  }
  if (parts.includes('speech')) try {
    await speechFlow(browser, base);
  } catch (e) {
    check('speech flow run completed', false, e.message.split('\n')[0]);
  }
  if (parts.includes('voice')) try {
    await voiceChecks(browser, base);
  } catch (e) {
    check('recorded voice run completed', false, e.message.split('\n')[0]);
  }
  if (parts.includes('fullscreen')) try {
    await fullscreenChecks(browser, base);
  } catch (e) {
    check('fullscreen run completed', false, e.message.split('\n')[0]);
  }
  if (parts.includes('trips')) try {
    await tripChecks(browser, base);
  } catch (e) {
    check('trip run completed', false, e.message.split('\n')[0]);
  }
  if (parts.includes('name')) try {
    await nameChecks(browser, base);
  } catch (e) {
    check('name run completed', false, e.message.split('\n')[0]);
  }
  if (parts.includes('languages')) try {
    await languageChecks(browser, base);
  } catch (e) {
    check('language run completed', false, e.message.split('\n')[0]);
  }
  await browser.close();
  if (server) server.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  fs.writeFileSync(path.join(shotsDir, 'results.json'), JSON.stringify({ base, results }, null, 2));
  process.exit(failed.length ? 1 : 0);
})();
