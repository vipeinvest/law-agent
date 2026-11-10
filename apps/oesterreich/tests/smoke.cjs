#!/usr/bin/env node
/* Smoke test for Die große Österreich-Expedition.
 *   node tests/smoke.cjs                 # tests public/ with a strict CSP, like the web server
 *   node tests/smoke.cjs --url https://…  # tests a deployed copy
 * Exit code 0 = all checks passed. Screenshots go to tests/screenshots/.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const args = process.argv.slice(2);
const opt = (n, d) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : d);
const ROOT = path.join(__dirname, '..');
const shots = path.join(ROOT, 'tests', 'screenshots');
fs.mkdirSync(shots, { recursive: true });
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.txt': 'text/plain' };
function serve(dir) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
    if (!p || p.endsWith('/')) p += 'index.html';
    const file = path.join(dir, path.normalize(p));
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(page, fn, arg, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await page.evaluate(fn, arg).catch(() => false)) return true;
    await sleep(80);
  }
  return false;
}
const mode = (page) => page.evaluate(() => window.__oe.mode);

// Answers the open question. wrongFirst: give one wrong answer before the right one.
async function answer(page, wrongFirst) {
  const q = await page.evaluate(() => window.__oe.quiz);
  if (q.map) {
    if (wrongFirst) {
      const other = q.map === 'state' ? (q.target === 'ST' ? 'T' : 'ST') : (q.target === 'DE' ? 'IT' : 'DE');
      const w = await page.evaluate((k) => window.__oe.quizPoint(k), other);
      await page.mouse.click(w.x, w.y);
    }
    const p = await page.evaluate((k) => window.__oe.quizPoint(k), q.target);
    await page.mouse.click(p.x, p.y);
  } else {
    const opts = page.locator('#quizOpts .opt');
    const n = await opts.count();
    if (wrongFirst) for (let i = 0; i < n; i++) if ((await opts.nth(i).textContent()) !== q.right) { await opts.nth(i).click(); break; }
    for (let i = 0; i < n; i++) if ((await opts.nth(i).textContent()) === q.right) { await opts.nth(i).click(); break; }
  }
  return q;
}

async function dataChecks(page) {
  console.log('\n▶ Inhalte');
  const d = await page.evaluate(() => {
    const oe = window.__oe;
    const C = window.OE_CONTENT;
    const bad = [];
    for (const p of oe.places) {
      if (p.kind === 'stadt' && oe.stateAt(p.lon, p.lat) !== p.st) bad.push(`${p.id} not in ${p.st}`);
      if (p.kind === 'nachbar' && oe.countryAt(p.lon, p.lat) !== p.c) bad.push(`${p.id} in ${oe.countryAt(p.lon, p.lat)}`);
      // the Bodensee marker floats on the lake, just off the Austrian shore
      if (p.kind !== 'nachbar' && p.id !== 'bodensee' && oe.countryAt(p.lon, p.lat) !== 'AT') bad.push(`${p.id} outside Austria`);
    }
    for (const n of oe.nodes) if (oe.countryAt(n.lon, n.lat) !== 'AT') bad.push(`node ${n.i} outside Austria`);
    const close = [];
    const all = [...oe.places.map((p) => ({ n: p.id, x: p.x, y: p.y })), ...oe.nodes.map((n) => ({ n: 'node' + n.i, x: n.x, y: n.y }))];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y) < 36) close.push(`${all[i].n}/${all[j].n}`);
    const res = new Set(oe.nodes.map((n) => n.res));
    const art = Object.entries(C.BUILDS).filter(([, b]) => b.art.length !== 14 || b.art.some((r) => r.length !== 12) || [...b.art.join('')].some((ch) => ch !== '.' && !C.PALETTE[ch])).map(([k]) => k);
    const need = Object.entries(oe.builds).filter(([, n]) => Object.keys(n).some((r) => !res.has(r))).map(([k]) => k);
    const qs = oe.questions();
    const ids = new Set(qs.map((q) => q.id));
    const badQ = qs.filter((q) => !q.map && (q.n !== 3 || q.uniq !== 3)).map((q) => q.id);
    const long = [...C.PLACES.flatMap((p) => p.facts), ...C.Q.map((q) => q.e)].filter((t) => t.split(/\s+/).length > 32).length;
    return { bad, close, art, need, nq: qs.length, dup: qs.length - ids.size, badQ, long, places: oe.places.length, lv: [1, 2, 3].map((l) => qs.filter((q) => q.lv === l).length), areas: Object.keys(C.AREAS).map((a) => qs.filter((q) => q.area === a).length) };
  });
  check('capitals lie in their Bundesland, neighbours in their country, everything else in Austria', d.bad.length === 0, d.bad.join(', '));
  check('no two map spots sit on top of each other', d.close.length === 0, d.close.join(', '));
  check('all nine landmarks have a valid 12×14 block picture', d.art.length === 0, d.art.join(','));
  check('every building material can be gathered somewhere', d.need.length === 0, d.need.join(','));
  check('question ids are unique and choices have three different answers', d.dup === 0 && d.badQ.length === 0, d.badQ.join(','));
  check('questions for all three levels and all six areas', d.lv.every((n) => n >= 8) && d.areas.every((n) => n >= 6), `${d.nq} questions, levels ${d.lv.join('/')}, areas ${d.areas.join('/')}`);
  check('texts stay short (no fact over 32 words)', d.long === 0, String(d.long));
  check('37 places to discover', d.places === 37);
}

async function play(browser, base, label, ctxOpts, full) {
  console.log(`\n▶ ${label}`);
  const context = await browser.newContext({ ...ctxOpts, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  const foreign = [];
  const origin = new URL(base).origin;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { const u = r.url(); if (!/^(data|blob):/.test(u) && new URL(u).origin !== origin) foreign.push(u); });
  const tag = label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const shot = (n) => page.screenshot({ path: path.join(shots, `${tag}-${n}.png`) });
  const resp = await page.goto(base, { waitUntil: 'load' });
  check(`${label}: page loads`, resp.ok());
  await waitFor(page, () => !!window.__oe && window.__oe.mode === 'title');
  await sleep(400);
  await shot('1-title');
  if (full) await dataChecks(page);
  check(`${label}: no horizontal scrolling`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.click('#btnStart');
  for (let i = 0; i < 8 && (await mode(page)) === 'talk'; i++) { await page.click('#btnTalkNext'); await sleep(100); }
  check(`${label}: intro leads into the game`, (await mode(page)) === 'play');
  await sleep(300);
  const vp = page.viewportSize();
  const bad = await page.evaluate(() => [...document.querySelectorAll('#hud button')].filter((b) => b.offsetParent).map((b) => ({ id: b.id, r: b.getBoundingClientRect() })).filter(({ r }) => r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5 || Math.min(r.width, r.height) < 44).map((b) => b.id));
  check(`${label}: HUD buttons on screen and at least 44 px`, bad.length === 0, bad.join(','));

  // holding a finger on the map walks there
  const cdp = await context.newCDPSession(page);
  const p0 = await page.evaluate(() => window.__oe.pos);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: vp.width * 0.8, y: vp.height * 0.62, id: 1 }] });
  await sleep(1000);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const p1 = await page.evaluate(() => window.__oe.pos);
  check(`${label}: holding a finger on the map moves the figure`, p1.x > p0.x + 40, `Δx=${Math.round(p1.x - p0.x)}`);
  await shot('2-play');

  const P = await page.evaluate(() => window.__oe.places);
  const N = await page.evaluate(() => window.__oe.nodes);
  const go = async (o, dx = 8, dy = 4) => { await page.evaluate(([x, y]) => window.__oe.teleport(x, y), [o.x + dx, o.y + dy]); };
  const closeCard = async () => {
    await waitFor(page, () => window.__oe.mode === 'card');
    await page.click('#btnCardClose');
    await sleep(120);
    if ((await mode(page)) === 'quiz') { await answer(page, false); await page.click('#btnQuizNext'); await sleep(100); }
  };

  // discover Vienna
  await go(P.find((p) => p.id === 'wien'));
  check(`${label}: walking into Vienna opens its card`, await waitFor(page, () => window.__oe.mode === 'card'));
  await sleep(300);
  await shot('3-card');
  await closeCard();

  // gather: hold the action button at a clay pit
  const clay = N.find((n) => n.res === 'lehm');
  await go(clay, 10, 6);
  await waitFor(page, () => !document.getElementById('btnAct').hidden);
  const box = await page.locator('#btnAct').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const got = await waitFor(page, () => window.__oe.inv.lehm === 2, null, 4000);
  await page.mouse.up();
  check(`${label}: holding the button mines two blocks`, got);
  check(`${label}: the quest now names what is still missing`, /fehlt noch|Du hast alles/.test(await page.evaluate(() => window.__oe.quest)), await page.evaluate(() => window.__oe.quest.slice(0, 70)));
  await shot('4-gather');

  // build the Stephansdom, with one wrong answer first
  await page.evaluate(() => { for (const r of Object.keys(window.__oe.inv)) window.__oe.give(r, 40); });
  await go(P.find((p) => p.id === 'wien'), -20, -20);
  await waitFor(page, () => !document.getElementById('btnAct').hidden && /Baustelle/.test(document.getElementById('btnAct').textContent));
  await page.click('#btnAct');
  check(`${label}: the building site opens`, (await mode(page)) === 'build' && (await page.isVisible('#btnBuildGo')));
  await shot('5-site');
  await page.click('#btnBuildGo');
  await waitFor(page, () => window.__oe.mode === 'quiz');
  await sleep(200);
  await shot('6-question');
  const q = await page.evaluate(() => window.__oe.quiz);
  if (q.map) {
    const w = await page.evaluate(() => window.__oe.quizPoint('ST'));
    await page.mouse.click(w.x, w.y);
  } else await answer(page, true);
  const retry = await page.evaluate(() => !document.getElementById('quizFb').hidden && !window.__oe.quiz.solved);
  if (q.map) await answer(page, false);
  check(`${label}: a wrong answer gives a hint and a second try, no penalty`, retry && (await page.evaluate(() => window.__oe.quiz.solved)));
  check(`${label}: the answer is explained`, (await page.textContent('#quizFb')).length > 20);
  await page.click('#btnQuizNext');
  const builtW = await waitFor(page, () => window.__oe.built.includes('W'), null, 12000);
  check(`${label}: the landmark is built block by block`, builtW);
  await shot('7-built');
  await page.click('#btnBuildClose');

  // Forscherheft, overview map, pause
  await page.click('#btnBook');
  const bookOk = (await mode(page)) === 'book' && (await page.locator('#bookBody .item').count()) === 9;
  await page.click('.tab[data-tab="wissen"]');
  const meters = await page.locator('#bookBody .meter').count();
  await shot('8-book');
  await page.click('#btnBookClose');
  check(`${label}: Forscherheft shows nine Bundesländer and the knowledge meters`, bookOk && meters === 6);
  await page.click('#btnMap');
  await sleep(200);
  await shot('9-map');
  check(`${label}: overview map opens with its legend`, (await mode(page)) === 'map' && (await page.locator('.legend li').count()) === 5);
  await page.click('#btnMapClose');
  await page.click('#btnPause');
  check(`${label}: pause opens`, (await mode(page)) === 'pause');
  await page.click('#btnResume');

  if (full) {
    for (const p of P.filter((x) => x.kind === 'stadt' && x.id !== 'wien')) {
      await go(p);
      await closeCard();
      await go(p, -20, -20);
      await waitFor(page, () => !document.getElementById('btnAct').hidden && /Baustelle/.test(document.getElementById('btnAct').textContent));
      await page.click('#btnAct');
      await page.click('#btnBuildGo');
      await waitFor(page, () => window.__oe.mode === 'quiz');
      await answer(page, false);
      await page.click('#btnQuizNext');
      await waitFor(page, (st) => window.__oe.built.includes(st), p.st, 12000);
      await page.click('#btnBuildClose');
      await sleep(60);
    }
    check(`${label}: all nine landmarks can be built`, (await page.evaluate(() => window.__oe.built.length)) === 9);
    check(`${label}: the quest then sends you to the neighbours`, /Nachbarland/.test(await page.evaluate(() => window.__oe.quest)));
    for (const p of P.filter((x) => x.kind === 'nachbar')) {
      await go(p, 6, 3);
      await waitFor(page, () => window.__oe.mode === 'card');
      if (p.c === 'LI') { await sleep(300); await shot('10-neighbour'); }
      await page.click('#btnCardClose');
      await sleep(100);
      if ((await mode(page)) === 'quiz') { await answer(page, false); await page.click('#btnQuizNext'); await sleep(100); }
    }
    check(`${label}: all eight neighbours visited leads to the certificate`, await waitFor(page, () => window.__oe.mode === 'end', null, 4000));
    await sleep(300);
    await shot('11-certificate');
    await page.click('#btnEndGo');
    for (const p of P.filter((x) => x.kind !== 'stadt' && x.kind !== 'nachbar')) { await go(p, 6, 3); await closeCard(); }
    check(`${label}: all 37 places can be discovered`, (await page.evaluate(() => window.__oe.found.length)) === 37);
  }

  // progress survives a reload
  await page.click('#btnPause');
  await page.reload({ waitUntil: 'load' });
  await waitFor(page, () => !!window.__oe && window.__oe.mode === 'title');
  const cont = await page.isVisible('#btnContinue');
  if (cont) await page.click('#btnContinue');
  await sleep(100);
  check(`${label}: progress survives a reload`, cont && (await page.evaluate(() => window.__oe.built.includes('W'))));
  check(`${label}: no JavaScript errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  check(`${label}: no third-party requests`, foreign.length === 0, foreign.slice(0, 3).join(', '));
  await context.close();
}

(async () => {
  let server = null;
  let base = opt('--url', null);
  if (!base) {
    server = await serve(path.resolve(opt('--dir', path.join(ROOT, 'public'))));
    base = `http://127.0.0.1:${server.address().port}/`;
  }
  const browser = await chromium.launch(process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : {});
  const runs = [
    ['iPad quer', devices['iPad (gen 7) landscape'], true],
    ['iPhone hochkant', devices['iPhone 13'], false],
    ['iPhone quer', devices['iPhone 13 landscape'], false],
    ['iPad hochkant', devices['iPad (gen 7)'], false],
    ['Desktop', { viewport: { width: 1280, height: 800 }, hasTouch: true }, false],
  ];
  for (const [label, ctx, full] of runs) {
    try { await play(browser, base, label, ctx, full); } catch (e) { check(`${label}: run completed`, false, e.message.split('\n')[0]); }
  }
  await browser.close();
  if (server) server.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})();
