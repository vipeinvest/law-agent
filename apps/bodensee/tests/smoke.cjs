#!/usr/bin/env node
/* Smoke test for Leopolds Bodensee-Expedition.
 *
 *   node tests/smoke.cjs --dir public            # local build, served with the production headers
 *   node tests/smoke.cjs --url https://bodensee.malelu.io
 *
 *   node tests/smoke.cjs --url http://127.0.0.1:8080/ --allow-http   # the built container
 *
 * Options: --shots <dir> (screenshots), --quick (fewer devices), --full (complete play-through on every device)
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
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain',
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
async function waitFor(page, fn, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await page.evaluate(fn).catch(() => false)) return true;
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
  const runs = [
    ['iPhone 13 hochkant', devices['iPhone 13']],
    ['iPhone 13 quer', devices['iPhone 13 landscape']],
    ['iPad hochkant', devices['iPad (gen 7)']],
    ['iPad quer', devices['iPad (gen 7) landscape']],
    ['Desktop', { viewport: { width: 1280, height: 800 }, hasTouch: true, deviceScaleFactor: 1 }],
  ];
  const list = has('--quick') ? [runs[0], runs[2]] : runs;
  for (const [label, ctx] of list) {
    try {
      await runDevice(browser, base, label, ctx, has('--full') || label === 'iPad quer' || label === 'iPhone 13 quer');
    } catch (e) {
      check(`${label}: run completed`, false, e.message.split('\n').slice(0, 3).join(' '));
    }
  }
  try {
    await speechFallback(browser, base);
  } catch (e) {
    check('speech fallback run completed', false, e.message.split('\n')[0]);
  }
  try {
    await speechFlow(browser, base);
  } catch (e) {
    check('speech flow run completed', false, e.message.split('\n')[0]);
  }
  try {
    await fullscreenChecks(browser, base);
  } catch (e) {
    check('fullscreen run completed', false, e.message.split('\n')[0]);
  }
  await browser.close();
  if (server) server.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  fs.writeFileSync(path.join(shotsDir, 'results.json'), JSON.stringify({ base, results }, null, 2));
  process.exit(failed.length ? 1 : 0);
})();
