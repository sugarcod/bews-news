/**
 * Static RSS sync for the GitHub Actions → `data` branch pipeline.
 *
 *   node scripts/sync-feeds-static.ts [--out data-branch] [--existing <url|file>]
 *
 * 1. loads the previous articles.json (so older stories and already-extracted
 *    full texts are kept without re-fetching),
 * 2. fetches all 13 feeds, de-duplicates and classifies topics,
 * 3. extracts full text for recent stories (Readability / RSS content),
 * 4. writes <out>/articles.json and <out>/meta.json.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SOURCES } from '../src/core/feeds.ts';
import { fetchAllFeeds } from '../src/core/feed.ts';
import { extractArticle } from '../src/core/extract.ts';
import type { StaticArticle, StaticData, StaticMeta } from '../src/shared/static.ts';

const args = process.argv.slice(2);
const arg = (name: string, def: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const repo = process.env.GITHUB_REPOSITORY || 'sugarcod/bews-news';
const OUT = resolve(arg('out', 'data-branch'));
const EXISTING = arg('existing', process.env.DATA_URL || `https://raw.githubusercontent.com/${repo}/data/articles.json`);
const KEEP_DAYS = Number(process.env.KEEP_DAYS || 14);
const EXTRACT_HOURS = Number(process.env.EXTRACT_HOURS || 72);
const EXTRACT_MAX = Number(process.env.EXTRACT_MAX || 400);
const CONCURRENCY = 8;

async function loadExisting(): Promise<StaticArticle[]> {
  try {
    let text: string;
    if (/^https?:/.test(EXISTING)) {
      const res = await fetch(`${EXISTING}?t=${Date.now()}`, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    } else {
      if (!existsSync(EXISTING)) return [];
      text = readFileSync(EXISTING, 'utf8');
    }
    const data = JSON.parse(text) as StaticData;
    console.log(`[sync] loaded ${data.articles.length} existing articles`);
    return data.articles;
  } catch (e) {
    console.log(`[sync] no previous articles.json (${e instanceof Error ? e.message : e}) — starting fresh`);
    return [];
  }
}

const started = Date.now();
const previous = await loadExisting();
const byUrl = new Map(previous.map((a) => [a.url, a]));
const previousUrls = new Set(byUrl.keys());

const results = await fetchAllFeeds(SOURCES);
const seenUrls = new Set<string>();
const rssContent = new Map<string, string>();
let fresh = 0;
for (const r of results) {
  console.log(`[sync] ${r.source.id.padEnd(15)} ${r.source.lang} ${String(r.items.length).padStart(3)}${r.error ? `  ERROR ${r.error}` : ''}`);
  for (const it of r.items) {
    const old = byUrl.get(it.url);
    if (!previousUrls.has(it.url) && !seenUrls.has(it.url) && it.publishedAt >= Date.now() - KEEP_DAYS * 86400_000) fresh++;
    seenUrls.add(it.url);
    if (it.rssContent) rssContent.set(it.url, it.rssContent);
    byUrl.set(it.url, {
      id: it.id, url: it.url, title: it.title, summary: it.summary, sourceId: it.sourceId, lang: it.lang, topic: it.topic,
      image: it.image ?? old?.image ?? null, publishedAt: it.publishedAt,
      paragraphs: old?.paragraphs, extraction: old?.extraction, extractedAt: old?.extractedAt,
    });
  }
}

const cutoff = Date.now() - KEEP_DAYS * 86400_000;
const articles = [...byUrl.values()].filter((a) => a.publishedAt >= cutoff).sort((a, b) => b.publishedAt - a.publishedAt);

// Full text for recent stories (retry summary-only fallbacks after 12h).
const needs = articles
  .filter((a) => Date.now() - a.publishedAt < EXTRACT_HOURS * 3600_000)
  .filter((a) => !a.paragraphs || (a.extraction === 'summary' && Date.now() - (a.extractedAt || 0) > 12 * 3600_000))
  .slice(0, EXTRACT_MAX);
let done = 0;
let full = 0;
const queue = [...needs];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const a = queue.shift()!;
      const r = await extractArticle({ url: a.url, lang: a.lang, title: a.title, summary: a.summary, rssContent: rssContent.get(a.url) }, 12_000);
      a.paragraphs = r.paragraphs;
      a.extraction = r.extraction;
      a.extractedAt = Date.now();
      done++;
      if (r.extraction !== 'summary') full++;
    }
  }),
);
console.log(`[sync] extracted ${done} articles (${full} full text)`);

const updatedAt = Date.now();
const data: StaticData = { version: 1, updatedAt, articles };
const meta: StaticMeta = {
  version: 1,
  updatedAt,
  durationMs: updatedAt - started,
  counts: {
    all: articles.length,
    en: articles.filter((a) => a.lang === 'en').length,
    he: articles.filter((a) => a.lang === 'he').length,
    extracted: articles.filter((a) => a.extraction && a.extraction !== 'summary').length,
  },
  sources: results.map((r) => ({ id: r.source.id, count: r.items.length, fetchedAt: updatedAt, error: r.error ?? null })),
};
mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'articles.json'), JSON.stringify(data));
writeFileSync(resolve(OUT, 'meta.json'), JSON.stringify(meta, null, 2));
console.log(`[sync] wrote ${articles.length} articles (EN ${meta.counts.en} / HE ${meta.counts.he}, +${fresh} new, ${meta.counts.extracted} with full text) to ${OUT} in ${meta.durationMs}ms`);
const failed = results.filter((r) => r.error);
if (failed.length === SOURCES.length) process.exit(1);
