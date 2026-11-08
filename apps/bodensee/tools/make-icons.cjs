// Rasterizes src/assets/icon.svg into the PNG icons (run once after changing the SVG).
// Usage: node tools/make-icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const dir = path.join(__dirname, '..', 'src', 'assets');
  const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
  const browser = await chromium.launch();
  for (const [name, size, rounded] of [['apple-touch-icon.png', 180, false], ['icon-192.png', 192, true], ['icon-512.png', 512, true]]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    // Apple applies its own rounded mask: give it a square, full-bleed icon.
    const src = rounded ? svg : svg.replace('rx="112"', 'rx="0"');
    await page.setContent(`<html><body style="margin:0;background:#04202a">${src.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({ path: path.join(dir, name), omitBackground: rounded });
    await page.close();
  }
  await browser.close();
  console.log('icons written');
})();
