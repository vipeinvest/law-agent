#!/usr/bin/env node
/* Lists every text the game reads aloud, per language, for recording the narration with tools/voice.mjs.
 * The texts come from the running game (window.__bodensee.speech()), so composed messages match exactly.
 *
 *   node build.mjs && node tools/voice-texts.cjs --out dist/voice/texts.json
 *
 * Needs Playwright like tests/smoke.cjs (PW_EXECUTABLE points to an installed Chromium or Edge).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const OUT = path.resolve(opt('--out', path.join(ROOT, 'dist', 'voice', 'texts.json')));
const LANGS = ['de', 'en', 'it', 'fr'];
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
    if (p === '' || p.endsWith('/')) p += 'index.html';
    const file = path.join(PUB, path.normalize(p));
    if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

(async () => {
  const version = JSON.parse(fs.readFileSync(path.join(PUB, 'version.json'), 'utf8'));
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch(process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : {});
  const langs = {};
  for (const lang of LANGS) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    context.setDefaultTimeout(120000);
    const page = await context.newPage();
    await page.goto(`${base}?lang=${lang}`, { waitUntil: 'load' });
    await page.waitForFunction((l) => window.__bodensee && window.__bodensee.mode === 'title' && document.documentElement.lang === l, lang);
    langs[lang] = await page.evaluate(() => window.__bodensee.speech());
    const chars = langs[lang].reduce((n, t) => n + t.spoken.length, 0);
    console.log(`${lang}: ${langs[lang].length} texts, ${chars} characters`);
    await context.close();
  }
  await browser.close();
  server.close();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({ game: version.version, made: new Date().toISOString(), langs }, null, 1)}\n`);
  console.log(`written ${OUT}`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
