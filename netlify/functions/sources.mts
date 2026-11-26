import type { Config } from '@netlify/functions';
import { SOURCES } from '../../src/core/feeds.ts';
import { json, loadArticles, loadMeta } from '../lib/data.ts';

export default async () => {
  const [meta, { articles }] = await Promise.all([loadMeta(), loadArticles()]);
  const counts = new Map<string, number>();
  for (const a of articles) counts.set(a.sourceId, (counts.get(a.sourceId) || 0) + 1);
  const status = new Map((meta?.sources || []).map((s) => [s.id, s]));
  return json(
    SOURCES.map((s) => ({
      ...s,
      lastFetchedAt: status.get(s.id)?.fetchedAt ?? null,
      lastCount: status.get(s.id)?.count ?? null,
      lastError: status.get(s.id)?.error ?? null,
      articleCount: counts.get(s.id) || 0,
    })),
    { maxAge: 120 },
  );
};

export const config: Config = { path: '/api/sources' };
