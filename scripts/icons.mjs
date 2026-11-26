// Renders the SVG app icons to PNG with headless Chrome (playwright-core).
// `node scripts/icons.mjs --check` only verifies the PNGs exist (used by `npm run build`).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(import.meta.dirname, '..', 'public', 'icons');
const targets = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
];
if (process.argv.includes('--check')) {
  const missing = targets.filter(([, png]) => !existsSync(resolve(dir, png)));
  if (missing.length) { console.error('Missing icons:', missing.map((m) => m[1]).join(', '), '— run `npm run icons`'); process.exit(1); }
  console.log('icons ok');
  process.exit(0);
}
const { chromium } = await import('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
for (const [svg, png, size] of targets) {
  await page.setViewportSize({ width: size, height: size });
  const markup = readFileSync(resolve(dir, svg), 'utf8');
  await page.setContent(`<html><body style="margin:0">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  writeFileSync(resolve(dir, png), await page.screenshot({ omitBackground: true }));
  console.log('wrote', png);
}
await browser.close();
