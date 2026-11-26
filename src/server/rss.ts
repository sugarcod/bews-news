import { db, setMeta, getMeta } from './db.ts';
import { SOURCES } from '../core/feeds.ts';
import { fetchFeed } from '../core/feed.ts';
import type { SourceInfo } from '../shared/types.ts';

export { articleId } from '../core/feed.ts';
export const REFRESH_INTERVAL_MIN = Number(process.env.REFRESH_INTERVAL_MIN || 30);

const upsert = db.prepare(`
INSERT INTO articles (id, url, title, summary, rss_content, source_id, lang, topic, categories, image, published_at, fetched_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  summary = excluded.summary,
  rss_content = COALESCE(excluded.rss_content, articles.rss_content),
  topic = excluded.topic,
  published_at = excluded.published_at,
  categories = excluded.categories,
  image = COALESCE(excluded.image, articles.image)
`);
const setStatus = db.prepare(`
INSERT INTO source_status (source_id, last_fetched_at, last_count, last_error) VALUES (?, ?, ?, ?)
ON CONFLICT(source_id) DO UPDATE SET last_fetched_at = excluded.last_fetched_at, last_count = excluded.last_count, last_error = excluded.last_error
`);

export interface SourceResult { id: string; name: string; lang: string; count: number; error?: string }

async function fetchSource(src: SourceInfo): Promise<SourceResult> {
  const now = Date.now();
  try {
    const items = await fetchFeed(src);
    let count = 0;
    db.exec('BEGIN');
    try {
      for (const it of items) {
        upsert.run(it.id, it.url, it.title, it.summary, it.rssContent, it.sourceId, it.lang, it.topic, JSON.stringify(it.categories), it.image, it.publishedAt, now);
        count++;
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    setStatus.run(src.id, now, count, null);
    return { id: src.id, name: src.name, lang: src.lang, count };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setStatus.run(src.id, now, 0, msg.slice(0, 300));
    return { id: src.id, name: src.name, lang: src.lang, count: 0, error: msg };
  }
}

let running: Promise<RefreshReport> | null = null;
export const isRefreshing = () => running !== null;

export interface RefreshReport {
  startedAt: number;
  finishedAt: number;
  sources: SourceResult[];
  totalItems: number;
  newArticles: number;
  totals: { all: number; en: number; he: number };
}

function counts() {
  const r = db.prepare(`SELECT COUNT(*) AS all_, SUM(lang='en') AS en, SUM(lang='he') AS he FROM articles`).get() as { all_: number; en: number | null; he: number | null };
  return { all: r.all_, en: r.en || 0, he: r.he || 0 };
}

export function refreshAll(): Promise<RefreshReport> {
  if (running) return running;
  running = (async () => {
    const startedAt = Date.now();
    const before = counts().all;
    const results = await Promise.all(SOURCES.map(fetchSource));
    // Keep the DB lean: drop old, un-bookmarked articles after 21 days.
    db.prepare(`DELETE FROM articles WHERE published_at < ? AND id NOT IN (SELECT article_id FROM bookmarks)`).run(Date.now() - 21 * 86400_000);
    const totals = counts();
    const finishedAt = Date.now();
    setMeta('last_refresh_at', String(finishedAt));
    const report: RefreshReport = {
      startedAt,
      finishedAt,
      sources: results,
      totalItems: results.reduce((a, r) => a + r.count, 0),
      newArticles: Math.max(0, totals.all - before),
      totals,
    };
    const failed = results.filter((r) => r.error);
    console.log(`[rss] refreshed ${results.length} feeds in ${finishedAt - startedAt}ms: ${report.totalItems} items, +${report.newArticles} new (EN ${totals.en} / HE ${totals.he})${failed.length ? `; failed: ${failed.map((f) => `${f.id} (${f.error})`).join(', ')}` : ''}`);
    return report;
  })().finally(() => {
    running = null;
  });
  return running;
}

let nextRefreshAt: number | null = null;
export const getNextRefreshAt = () => nextRefreshAt;
export const getLastRefreshAt = () => {
  const v = getMeta('last_refresh_at');
  return v ? Number(v) : null;
};

export function startScheduler(): void {
  const interval = REFRESH_INTERVAL_MIN * 60_000;
  const tick = () => {
    nextRefreshAt = Date.now() + interval;
    refreshAll().catch((e) => console.error('[rss] refresh failed', e));
  };
  tick(); // on startup
  setInterval(tick, interval).unref?.();
}
