import { db } from './db.ts';
import { extractArticle } from '../core/extract.ts';
import type { ArticleFull, NewsLang, Topic } from '../shared/types.ts';

interface Row {
  id: string; url: string; title: string; summary: string; rss_content: string | null;
  source_id: string; lang: NewsLang; topic: Topic; image: string | null; published_at: number;
  paragraphs: string | null; extraction: ArticleFull['extraction'] | null;
}

const inflight = new Map<string, Promise<ArticleFull | null>>();

function toFull(r: Row, paragraphs: string[], extraction: ArticleFull['extraction']): ArticleFull {
  const bm = db.prepare('SELECT 1 FROM bookmarks WHERE article_id = ?').get(r.id);
  return {
    id: r.id, url: r.url, title: r.title, summary: r.summary, sourceId: r.source_id, lang: r.lang, topic: r.topic,
    image: r.image, publishedAt: r.published_at, bookmarked: !!bm, paragraphs, extraction,
  };
}

export async function getArticle(id: string): Promise<ArticleFull | null> {
  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(id) as Row | undefined;
  if (!row) return null;
  if (row.paragraphs && row.extraction) return toFull(row, JSON.parse(row.paragraphs), row.extraction);
  const existing = inflight.get(id);
  if (existing) return existing;

  const job = (async () => {
    const { paragraphs, extraction } = await extractArticle({ url: row.url, lang: row.lang, title: row.title, summary: row.summary, rssContent: row.rss_content });
    // Cache successful full-text results permanently; retry summary fallbacks after 6h.
    db.prepare('UPDATE articles SET paragraphs = ?, extraction = ?, extracted_at = ? WHERE id = ?').run(
      JSON.stringify(paragraphs), extraction, Date.now(), id,
    );
    return toFull(row, paragraphs, extraction);
  })().finally(() => inflight.delete(id));
  inflight.set(id, job);
  return job;
}

/** Summary fallbacks are re-tried later in case the site was only temporarily blocking. */
export function expireSummaryFallbacks(): void {
  db.prepare(`UPDATE articles SET paragraphs = NULL, extraction = NULL WHERE extraction = 'summary' AND extracted_at < ?`).run(Date.now() - 6 * 3600_000);
}
