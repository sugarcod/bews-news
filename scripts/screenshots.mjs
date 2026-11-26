// Captures mobile (390×844) previews of the running app into previews/.
// Usage: BASE=http://localhost:3000 node scripts/screenshots.mjs
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = resolve(import.meta.dirname, '..', 'previews');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));
const shot = (name) => page.screenshot({ path: resolve(OUT, name) }).then(() => console.log('saved', name));
const settle = (ms = 600) => page.waitForTimeout(ms);

// fresh UI state, Russian interface
await page.goto(`${BASE}/#/wire`);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('bews.lang', 'ru'); });
await page.goto(`${BASE}/#/wire`, { waitUntil: 'networkidle' });
await page.waitForSelector('.story-row');
await page.evaluate(() => document.fonts.ready);
await settle(900);
await shot('01-wire.png');

// Filter the Wire
await page.click('button[aria-label="Фильтры"]');
await page.waitForSelector('text=Фильтры ленты');
await page.click('.slide-in button:text-is("Неделя")');
await page.click('.slide-in button:text-is("Политика")');
await page.click('.slide-in button:text-is("Технологии")');
await settle(500);
await shot('02-filter.png');
await page.click('.slide-in button:text-is("Сбросить")');
await page.click('.slide-in button:text-is("Готово")');
await settle(400);

// Save a few Hebrew words first so the vocabulary has both languages
const heId = await page.evaluate(async () => {
  const list = await (await fetch('/api/articles?days=3')).json();
  const he = list.filter((a) => a.lang === 'he' && ['geektime', 'ynet', 'maariv', 'globes-he'].includes(a.sourceId));
  return he[0]?.id;
});
await page.goto(`${BASE}/#/wire/a/${heId}`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-s]');
for (const sel of ['[data-s="0-0"] .tok', '[data-s="1-0"] .tok', '[data-s="2-0"] .tok']) {
  const toks = page.locator(sel);
  const c = await toks.count();
  let pick = Math.min(1, c - 1);
  for (let i = 0; i < c; i++) { const t = (await toks.nth(i).innerText()).trim(); if (t.length >= 5) { pick = i; break; } }
  if (c === 0) continue;
  await toks.nth(pick).click();
  await page.waitForSelector('[role="dialog"] button:text-is("В словарь"):not([disabled]), [role="dialog"] button:has-text("Добавлено")', { timeout: 20000 });
  const add = page.locator('[role="dialog"] button:text-is("В словарь")');
  if (await add.count()) { await add.click(); await page.waitForSelector('[role="dialog"] button:has-text("Добавлено")'); }
  await page.click('[role="dialog"] button[aria-label="Close"]');
  await settle(300);
}

// Reader: pick an English story with real full text
const ids = await page.evaluate(async () => {
  const list = await (await fetch('/api/articles?days=3')).json();
  return list.filter((a) => a.lang === 'en' && ['bbc-world', 'guardian-world', 'jpost', 'ynetnews', 'techcrunch'].includes(a.sourceId)).slice(0, 8).map((a) => a.id);
});
let enId = null;
for (const id of ids) {
  const a = await page.evaluate(async (id) => (await fetch('/api/articles/' + id)).json(), id);
  if (a.extraction !== 'summary' && a.paragraphs.length >= 4) { enId = id; break; }
}
enId ??= ids[0];
await page.goto(`${BASE}/#/wire/a/${enId}`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-s]');
await settle(500);
async function addWord(sentenceKey, minLen = 7) {
  const toks = page.locator(`[data-s="${sentenceKey}"] .tok`);
  const c = await toks.count();
  // pick the longest word (most interesting to look up); minLen kept as a floor
  let pick = 0, best = 0;
  for (let i = 0; i < c; i++) { const t = (await toks.nth(i).innerText()).trim(); if (t.length >= minLen && t.length > best && /^[a-z]/.test(t)) { pick = i; best = t.length; } }
  if (!best) for (let i = 0; i < c; i++) { const t = (await toks.nth(i).innerText()).trim(); if (t.length > best) { pick = i; best = t.length; } }
  await toks.nth(pick).click();
  await page.waitForSelector('[role="dialog"] button:text-is("В словарь"):not([disabled]), [role="dialog"] button:has-text("Добавлено")', { timeout: 20000 });
  const add = page.locator('[role="dialog"] button:text-is("В словарь")');
  if (await add.count()) { await add.click(); await page.waitForSelector('[role="dialog"] button:has-text("Добавлено")'); }
}
// 1) a first English word from sentence 1
await addWord('0-0', 8);
await page.click('[role="dialog"] button[aria-label="Close"]');
await settle(300);
// 2) translate the second sentence, then tap a word inside it
const key = (await page.locator('[data-s="0-1"]').count()) ? '0-1' : '1-0';
await page.locator(`[data-s="${key}"] + .sent-btn`).click();
await page.waitForFunction(() => document.querySelector('.tr-block') && !document.querySelector('.tr-block .animate-spin'));
await addWord(key, 6);
await settle(900);
await shot('03-reader.png');

await page.goto(`${BASE}/#/vocab`, { waitUntil: 'networkidle' });
await page.waitForSelector('text=Экспорт CSV');
await settle(700);
await shot('04-vocab.png');

// bonus: English UI wire + Hebrew reader
await page.evaluate(() => localStorage.setItem('bews.lang', 'en'));
await page.goto(`${BASE}/#/wire`, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.story-row');
await settle(700);
await shot('05-wire-en.png');
await page.goto(`${BASE}/#/wire/a/${heId}`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-s]');
await page.locator('.sent-btn').nth(0).click();
await page.waitForFunction(() => document.querySelector('.tr-block') && !document.querySelector('.tr-block .animate-spin'));
await page.evaluate(() => document.getElementById('reader-scroll').scrollTo(0, 0));
await settle(400);
await shot('06-reader-he.png');
await page.evaluate(() => localStorage.setItem('bews.lang', 'ru'));

await browser.close();
