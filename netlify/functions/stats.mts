import type { Config } from '@netlify/functions';
import { providerInfo } from '../../src/lib/translator.ts';
import type { Stats } from '../../src/shared/types.ts';
import { json, loadArticles, loadMeta } from '../lib/data.ts';

const INTERVAL_MIN = 60;

/** Server-side part of the stats; the browser adds its own vocabulary / bookmark / translation-cache counts. */
export default async () => {
  const [meta, { articles, updatedAt }] = await Promise.all([loadMeta(), loadArticles()]);
  const last = meta?.updatedAt ?? updatedAt;
  const next = new Date(Date.now());
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  const stats: Stats = {
    articles: articles.length,
    articlesEn: articles.filter((a) => a.lang === 'en').length,
    articlesHe: articles.filter((a) => a.lang === 'he').length,
    extracted: articles.filter((a) => a.extraction && a.extraction !== 'summary').length,
    translations: 0,
    translationsWords: 0,
    translationsSentences: 0,
    vocab: 0,
    bookmarks: 0,
    lastRefreshAt: last,
    nextRefreshAt: next.getTime(),
    refreshIntervalMin: INTERVAL_MIN,
    refreshing: false,
    provider: providerInfo(),
  };
  return json(stats);
};

export const config: Config = { path: ['/api/stats', '/api/health'] };
