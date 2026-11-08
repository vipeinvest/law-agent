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
  const cardFits = await page.evaluate(() => {
    const r = document.querySelector('#card .card').getBoundingClientRect();
    return r.left >= -1 && r.right <= window.innerWidth + 1;
  });
  check(`${label}: discovery card fits the screen width`, cardFits);
  await page.click('#btnCardClose');

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
      check(`${label}: run completed`, false, e.message.split('\n')[0]);
    }
  }
  await browser.close();
  if (server) server.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  fs.writeFileSync(path.join(shotsDir, 'results.json'), JSON.stringify({ base, results }, null, 2));
  process.exit(failed.length ? 1 : 0);
})();
