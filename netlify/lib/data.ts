import { SOURCES } from '../../src/core/feeds.ts';
import { fetchAllFeeds, type FeedResult } from '../../src/core/feed.ts';
import type { StaticArticle, StaticData, StaticMeta } from '../../src/shared/static.ts';
import type { ArticleSummary } from '../../src/shared/types.ts';

export const REPO = process.env.BEWS_REPO || 'sugarcod/bews-news';
export const DATA_BASE = process.env.DATA_BASE_URL || `https://raw.githubusercontent.com/${REPO}/data`;
const TTL_MS = 120_000;

let cache: { at: number; data: StaticData } | null = null;
let metaCache: { at: number; meta: StaticMeta | null } | null = null;
/** Articles pulled live by /api/refresh on this (warm) instance. */
const overlay = new Map<string, StaticArticle>();

export function json(body: unknown, init: ResponseInit & { maxAge?: number } = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', init.maxAge ? `public, max-age=${init.maxAge}` : 'no-store');
  return new Response(JSON.stringify(body), { status: init.status || 200, headers });
}

export function toSummary(a: StaticArticle): ArticleSummary {
  return { id: a.id, url: a.url, title: a.title, summary: a.summary, sourceId: a.sourceId, lang: a.lang, topic: a.topic, image: a.image, publishedAt: a.publishedAt };
}

export function feedResultsToArticles(results: FeedResult[]): StaticArticle[] {
  const out: StaticArticle[] = [];
  for (const r of results) for (const it of r.items) {
    out.push({ id: it.id, url: it.url, title: it.title, summary: it.summary, sourceId: it.sourceId, lang: it.lang, topic: it.topic, image: it.image, publishedAt: it.publishedAt });
  }
  return out;
}

export function mergeArticles(base: StaticArticle[], extra: Iterable<StaticArticle>): StaticArticle[] {
  const byUrl = new Map(base.map((a) => [a.url, a]));
  for (const a of extra) {
    const old = byUrl.get(a.url);
    byUrl.set(a.url, old ? { ...a, paragraphs: old.paragraphs, extraction: old.extraction, image: a.image ?? old.image } : a);
  }
  return [...byUrl.values()].sort((a, b) => b.publishedAt - a.publishedAt);
}

/** articles.json from the `data` branch (cached per warm instance), falling back to a live RSS fetch. */
export async function loadArticles(): Promise<{ articles: StaticArticle[]; updatedAt: number; source: 'github' | 'live' }> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    try {
      const res = await fetch(`${DATA_BASE}/articles.json`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as StaticData;
      if (!Array.isArray(data.articles) || !data.articles.length) throw new Error('empty data');
      cache = { at: Date.now(), data };
    } catch (e) {
      console.warn('[data] GitHub data unavailable, fetching feeds live:', e instanceof Error ? e.message : e);
      if (!cache) {
        const live = feedResultsToArticles(await fetchAllFeeds(SOURCES, 7000));
        for (const a of live) overlay.set(a.url, a);
        return { articles: mergeArticles([], overlay.values()), updatedAt: Date.now(), source: 'live' };
      }
    }
  }
  const articles = overlay.size ? mergeArticles(cache!.data.articles, overlay.values()) : cache!.data.articles;
  return { articles, updatedAt: cache!.data.updatedAt, source: 'github' };
}

export function rememberLive(articles: StaticArticle[]): void {
  for (const a of articles) overlay.set(a.url, a);
  // keep the overlay bounded
  if (overlay.size > 1500) for (const k of [...overlay.keys()].slice(0, overlay.size - 1500)) overlay.delete(k);
}

export async function loadMeta(): Promise<StaticMeta | null> {
  if (metaCache && Date.now() - metaCache.at < TTL_MS) return metaCache.meta;
  try {
    const res = await fetch(`${DATA_BASE}/meta.json`, { signal: AbortSignal.timeout(6000) });
    const meta = res.ok ? ((await res.json()) as StaticMeta) : null;
    metaCache = { at: Date.now(), meta };
    return meta;
  } catch {
    return metaCache?.meta ?? null;
  }
}
