import type { Config } from '@netlify/functions';
import { SOURCES } from '../../src/core/feeds.ts';
import { fetchAllFeeds } from '../../src/core/feed.ts';
import { feedResultsToArticles, json, loadArticles, mergeArticles, rememberLive, toSummary } from '../lib/data.ts';

/** Live RSS pull on demand (the hourly GitHub Action keeps the persistent data set fresh). */
export default async () => {
  const startedAt = Date.now();
  const [{ articles: base }, results] = await Promise.all([loadArticles(), fetchAllFeeds(SOURCES, 7000)]);
  const live = feedResultsToArticles(results);
  const known = new Set(base.map((a) => a.url));
  const recent = Date.now() - 14 * 86400_000;
  const newArticles = new Set(live.filter((a) => !known.has(a.url) && a.publishedAt >= recent).map((a) => a.url)).size;
  rememberLive(live);
  const merged = mergeArticles(base, live);
  const cutoff = Date.now() - 30 * 86400_000;
  const articles = merged.filter((a) => a.publishedAt >= cutoff);
  return json({
    startedAt,
    finishedAt: Date.now(),
    sources: results.map((r) => ({ id: r.source.id, name: r.source.name, lang: r.source.lang, count: r.items.length, error: r.error })),
    totalItems: live.length,
    newArticles,
    totals: { all: articles.length, en: articles.filter((a) => a.lang === 'en').length, he: articles.filter((a) => a.lang === 'he').length },
    articles: articles.map(toSummary),
  });
};

export const config: Config = { path: '/api/refresh' };
