#!/usr/bin/env node
// Builds the game from src/ without dependencies.
//   public/            -> files for the web server (strict CSP: CSS and JS as separate files)
//   dist/artifact.html -> single-file version for a preview link
// Usage: node build.mjs [--version <git-sha>]
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf('--version');
const version = String((i > 0 && process.argv[i + 1]) || process.env.GIT_SHA || 'dev').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40) || 'dev';
const read = (f) => readFileSync(join(here, 'src', f), 'utf8');
const body = read('body.html').trim();
const css = read('style.css').trim();
const js = ['map-data.js', 'content.js', 'game.js'].map(read).join('\n').replace('__BUILD_VERSION__', version).trim();
const hash = createHash('sha256').update(body + css + js).digest('hex').slice(0, 10);
const TITLE = 'Die große Österreich-Expedition';

const pub = join(here, 'public');
rmSync(pub, { recursive: true, force: true });
mkdirSync(pub, { recursive: true });
writeFileSync(join(pub, 'index.html'), `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="description" content="Lernspiel für den Sachunterricht: Österreich erkunden, Rohstoffe sammeln, Wahrzeichen bauen.">
<meta name="theme-color" content="#a9cfe2">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<title>${TITLE}</title>
<link rel="stylesheet" href="style.css?v=${hash}">
</head>
<body>
${body}
<script src="game.js?v=${hash}" defer></script>
</body>
</html>
`);
writeFileSync(join(pub, 'style.css'), css + '\n');
writeFileSync(join(pub, 'game.js'), js + '\n');
writeFileSync(join(pub, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#c8102e"/><rect y="22" width="64" height="20" fill="#fff"/><path d="M14 46 30 18l8 12 5-7 9 23z" fill="#6f4a28"/><path d="m30 18 5 8-5-2-4 3z" fill="#fff"/></svg>\n');
writeFileSync(join(pub, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
writeFileSync(join(pub, 'version.json'), JSON.stringify({ app: 'oesterreich', version, hash }) + '\n');
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'artifact.html'), `<title>${TITLE}</title>\n<style>\n${css}\n</style>\n${body}\n<script>\n${js}\n</script>\n`);
console.log(`built ${TITLE} version=${version} hash=${hash} js=${(js.length / 1024).toFixed(0)}KB`);
