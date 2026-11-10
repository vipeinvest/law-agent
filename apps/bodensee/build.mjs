#!/usr/bin/env node
// Builds the game from src/ without any dependencies.
//   public/            -> what the nginx container serves (strict CSP: CSS and JS as separate files)
//   dist/artifact.html -> single-file version (inline CSS/JS) for a quick preview link
// Usage: node build.mjs [--version <git-sha>]
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const argIndex = process.argv.indexOf('--version');
const rawVersion = argIndex > 0 ? process.argv[argIndex + 1] : process.env.GIT_SHA || 'dev';
const version = String(rawVersion || 'dev').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40) || 'dev';

const read = (f) => readFileSync(join(here, 'src', f), 'utf8');
const body = read('body.html').trim();
const css = read('style.css').trim();
// The trips ashore come first: game.js starts them once its own parts are ready.
const SOURCES = ['i18n.js', 'i18n-en.js', 'i18n-it.js', 'i18n-fr.js', 'ext-core.js', 'ext-art.js', 'ext-landmarks.js', 'ext-era-art.js', 'ext-content.js', 'ext-map.js', 'ext-shore.js', 'ext-time.js', 'game.js'];
const js = SOURCES.map((f) => read(f)).join('\n').replace('__BUILD_VERSION__', version).trim();
const hash = createHash('sha256').update(body + css + js).digest('hex').slice(0, 10);

const TITLE = 'Die große Bodensee-Expedition';
const DESCRIPTION = 'Ein ruhiges Unterwasser-Abenteuer am Bodensee: Mit dem gelben U-Boot fünf Entdeckungsorte erforschen.';

const head = [
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">',
  `<meta name="description" content="${DESCRIPTION}">`,
  '<meta name="theme-color" content="#04202a">',
  '<meta name="color-scheme" content="dark">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="Bodensee">',
  '<meta name="format-detection" content="telephone=no">',
  '<meta name="robots" content="noindex, nofollow">',
  '<link rel="icon" href="icon.svg" type="image/svg+xml">',
  '<link rel="apple-touch-icon" href="apple-touch-icon.png">',
  '<link rel="manifest" href="manifest.webmanifest">',
].join('\n');

const pub = join(here, 'public');
rmSync(pub, { recursive: true, force: true });
mkdirSync(pub, { recursive: true });

writeFileSync(
  join(pub, 'index.html'),
  `<!doctype html>
<html lang="de">
<head>
${head}
<title>${TITLE}</title>
<link rel="stylesheet" href="style.css?v=${hash}">
</head>
<body>
${body}
<script src="game.js?v=${hash}" defer></script>
</body>
</html>
`,
);
writeFileSync(join(pub, 'style.css'), css + '\n');
writeFileSync(join(pub, 'game.js'), js + '\n');

const assets = join(here, 'src', 'assets');
for (const f of readdirSync(assets)) {
  if (f === 'sw.template.js') continue;
  copyFileSync(join(assets, f), join(pub, f));
}
// Placeholder for the recorded narration: production mounts the real audio/ folder over it (docker-compose.yml).
mkdirSync(join(pub, 'audio'), { recursive: true });
writeFileSync(join(pub, 'audio', 'index.json'), '{}\n');
const precache = ['./', './index.html', `./style.css?v=${hash}`, `./game.js?v=${hash}`, './manifest.webmanifest', './icon.svg', './apple-touch-icon.png'];
writeFileSync(
  join(pub, 'sw.js'),
  readFileSync(join(assets, 'sw.template.js'), 'utf8')
    .replace('__CACHE__', `bodensee-${hash}`)
    .replace('__PRECACHE__', JSON.stringify(precache)),
);
writeFileSync(join(pub, 'version.json'), JSON.stringify({ app: 'bodensee', version, hash, built: new Date().toISOString() }) + '\n');

// single-file preview (no doctype/html/head/body: the host wraps it)
const dist = join(here, 'dist');
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'artifact.html'), `<title>${TITLE}</title>\n<style>\n${css}\n</style>\n${body}\n<script>\n${js}\n</script>\n`);

console.log(`built ${TITLE} version=${version} hash=${hash}`);
