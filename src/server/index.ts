import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, DB_PATH } from './db.ts';
import { SOURCES, SOURCE_MAP } from '../core/feeds.ts';
import { refreshAll, startScheduler, isRefreshing, getLastRefreshAt, getNextRefreshAt, REFRESH_INTERVAL_MIN } from './rss.ts';
import { getArticle, expireSummaryFallbacks } from './extract.ts';
import { cachedTranslate } from './translate-cache.ts';
import { providerInfo } from '../lib/translator.ts';
import type { ArticleSummary, NewsLang, Stats, Topic, VocabEntry } from '../shared/types.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
// Optional local secrets / settings (.env is git-ignored).
if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));
const DIST = resolve(ROOT, 'dist');
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

type AsyncHandler = (req: Request, res: Response) => Promise<unknown> | unknown;
const h = (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res)).catch(next);
};

interface ArticleRow {
  id: string; url: string; title: string; summary: string; source_id: string; lang: NewsLang; topic: Topic;
  image: string | null; published_at: number; bookmarked: number;
}
const toSummary = (r: ArticleRow): ArticleSummary => ({
  id: r.id, url: r.url, title: r.title, summary: r.summary, sourceId: r.source_id, lang: r.lang, topic: r.topic,
  image: r.image, publishedAt: r.published_at, bookmarked: !!r.bookmarked,
});
const ARTICLE_COLS = `a.id, a.url, a.title, a.summary, a.source_id, a.lang, a.topic, a.image, a.published_at,
  EXISTS(SELECT 1 FROM bookmarks b WHERE b.article_id = a.id) AS bookmarked`;

// ---------------------------------------------------------------- articles
app.get('/api/sources', (_req, res) => {
  const status = new Map(
    (db.prepare('SELECT * FROM source_status').all() as { source_id: string; last_fetched_at: number; last_count: number; last_error: string | null }[]).map((s) => [s.source_id, s]),
  );
  const counts = new Map((db.prepare('SELECT source_id, COUNT(*) AS n FROM articles GROUP BY source_id').all() as { source_id: string; n: number }[]).map((r) => [r.source_id, r.n]));
  res.json(SOURCES.map((s) => ({
    ...s,
    lastFetchedAt: status.get(s.id)?.last_fetched_at ?? null,
    lastCount: status.get(s.id)?.last_count ?? null,
    lastError: status.get(s.id)?.last_error ?? null,
    articleCount: counts.get(s.id) || 0,
  })));
});

app.get('/api/articles', (req, res) => {
  const days = Math.min(Number(req.query.days) || 7, 3650);
  const all = req.query.all === '1';
  const limit = Math.min(Number(req.query.limit) || 800, 2000);
  const q = String(req.query.q || '').trim();
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (!all) { where.push('a.published_at >= ?'); params.push(Date.now() - days * 86400_000); }
  if (q) {
    where.push('(a.title LIKE ? OR a.summary LIKE ? OR a.topic LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (req.query.lang === 'en' || req.query.lang === 'he') { where.push('a.lang = ?'); params.push(req.query.lang); }
  const rows = db.prepare(`SELECT ${ARTICLE_COLS} FROM articles a ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.published_at DESC LIMIT ?`).all(...params, limit) as unknown as ArticleRow[];
  res.json(rows.map(toSummary));
});

app.get('/api/articles/:id', h(async (req, res) => {
  const a = await getArticle(String(req.params.id));
  if (!a) return res.status(404).json({ error: 'not_found' });
  res.json(a);
}));

app.all('/api/refresh', h(async (_req, res) => {
  const report = await refreshAll();
  res.json(report);
}));

// ---------------------------------------------------------------- translation
app.post('/api/translate', h(async (req, res) => {
  const text = String(req.body?.text ?? req.body?.q ?? '').trim();
  const source = (['en', 'he'].includes(req.body?.source) ? req.body.source : 'auto') as NewsLang | 'auto';
  const target = String(req.body?.target || 'ru').toLowerCase();
  if (!text) return res.status(400).json({ error: 'text_required' });
  if (text.length > 4000) return res.status(413).json({ error: 'text_too_long' });
  if (!/^[a-z]{2}$/.test(target)) return res.status(400).json({ error: 'bad_target' });
  try {
    res.json(await cachedTranslate(text, source, target));
  } catch (e) {
    res.status(502).json({ error: 'translation_failed', detail: e instanceof Error ? e.message : String(e) });
  }
}));
app.get('/api/translate', h(async (req, res) => {
  const text = String(req.query.q || req.query.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text_required' });
  const source = (['en', 'he'].includes(String(req.query.source)) ? req.query.source : 'auto') as NewsLang | 'auto';
  try {
    res.json(await cachedTranslate(text, source, String(req.query.target || 'ru')));
  } catch (e) {
    res.status(502).json({ error: 'translation_failed', detail: e instanceof Error ? e.message : String(e) });
  }
}));

// ---------------------------------------------------------------- vocabulary
interface VocabRow { id: number; word: string; translation: string; lang: NewsLang; context: string; article_title: string; article_url: string; article_id: string | null; created_at: number }
const toVocab = (r: VocabRow): VocabEntry => ({
  id: r.id, word: r.word, translation: r.translation, lang: r.lang, context: r.context, articleTitle: r.article_title,
  articleUrl: r.article_url, articleId: r.article_id, createdAt: r.created_at,
});

app.get('/api/vocab', (_req, res) => {
  res.json((db.prepare('SELECT * FROM vocab ORDER BY created_at DESC').all() as unknown as VocabRow[]).map(toVocab));
});
app.post('/api/vocab', (req, res) => {
  const b = req.body || {};
  const word = String(b.word || '').replace(/\s+/g, ' ').trim();
  const translation = String(b.translation || '').trim();
  const lang = b.lang === 'he' ? 'he' : 'en';
  if (!word || !translation) return res.status(400).json({ error: 'word_and_translation_required' });
  db.prepare(`INSERT INTO vocab (word, translation, lang, context, article_title, article_url, article_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(lang, word) DO UPDATE SET translation = excluded.translation, context = excluded.context,
      article_title = excluded.article_title, article_url = excluded.article_url, article_id = excluded.article_id`)
    .run(word, translation, lang, String(b.context || '').slice(0, 1000), String(b.articleTitle || ''), String(b.articleUrl || ''), b.articleId ? String(b.articleId) : null, Date.now());
  const row = db.prepare('SELECT * FROM vocab WHERE lang = ? AND word = ?').get(lang, word) as unknown as VocabRow;
  res.json(toVocab(row));
});
app.delete('/api/vocab/:id', (req, res) => {
  db.prepare('DELETE FROM vocab WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});
const csvCell = (s: string) => `"${String(s).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
app.get('/api/vocab/export.csv', (req, res) => {
  const lang = req.query.lang === 'en' || req.query.lang === 'he' ? String(req.query.lang) : null;
  const rows = (lang
    ? db.prepare('SELECT * FROM vocab WHERE lang = ? ORDER BY created_at').all(lang)
    : db.prepare('SELECT * FROM vocab ORDER BY created_at').all()) as unknown as VocabRow[];
  const lines = ['word,translation,context,language,source'];
  for (const r of rows) {
    const source = r.article_title && r.article_url ? `${r.article_title} — ${r.article_url}` : r.article_url || r.article_title;
    lines.push([r.word, r.translation, r.context, r.lang, source].map(csvCell).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="bews-vocabulary${lang ? '-' + lang : ''}.csv"`);
  res.send('\uFEFF' + lines.join('\r\n') + '\r\n');
});

// ---------------------------------------------------------------- bookmarks
app.get('/api/bookmarks', (_req, res) => {
  const rows = db.prepare(`SELECT ${ARTICLE_COLS} FROM bookmarks bm JOIN articles a ON a.id = bm.article_id ORDER BY bm.created_at DESC`).all() as unknown as ArticleRow[];
  res.json(rows.map(toSummary));
});
app.post('/api/bookmarks/:id', (req, res) => {
  db.prepare('INSERT OR IGNORE INTO bookmarks (article_id, created_at) VALUES (?, ?)').run(String(req.params.id), Date.now());
  res.json({ ok: true, bookmarked: true });
});
app.delete('/api/bookmarks/:id', (req, res) => {
  db.prepare('DELETE FROM bookmarks WHERE article_id = ?').run(String(req.params.id));
  res.json({ ok: true, bookmarked: false });
});

// ---------------------------------------------------------------- stats
app.get('/api/stats', (_req, res) => {
  const n = (sql: string) => (db.prepare(sql).get() as { n: number | null }).n || 0;
  const stats: Stats = {
    articles: n('SELECT COUNT(*) n FROM articles'),
    articlesEn: n(`SELECT COUNT(*) n FROM articles WHERE lang='en'`),
    articlesHe: n(`SELECT COUNT(*) n FROM articles WHERE lang='he'`),
    extracted: n(`SELECT COUNT(*) n FROM articles WHERE extraction IN ('readability','rss-content')`),
    translations: n('SELECT COUNT(*) n FROM translations'),
    translationsWords: n(`SELECT COUNT(*) n FROM translations WHERE kind='word'`),
    translationsSentences: n(`SELECT COUNT(*) n FROM translations WHERE kind='sentence'`),
    vocab: n('SELECT COUNT(*) n FROM vocab'),
    bookmarks: n('SELECT COUNT(*) n FROM bookmarks'),
    lastRefreshAt: getLastRefreshAt(),
    nextRefreshAt: getNextRefreshAt(),
    refreshIntervalMin: REFRESH_INTERVAL_MIN,
    refreshing: isRefreshing(),
    provider: providerInfo(),
  };
  res.json(stats);
});
app.get('/api/health', (_req, res) => res.json({ ok: true, db: DB_PATH, sources: SOURCE_MAP.size }));

app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[api]', err);
  res.status(500).json({ error: 'internal_error' });
});

// ---------------------------------------------------------------- static PWA
if (existsSync(DIST)) {
  app.use(express.static(DIST, {
    index: false,
    setHeaders(res, path) {
      if (/\/assets\//.test(path)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      else res.setHeader('Cache-Control', 'no-cache');
    },
  }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(resolve(DIST, 'index.html')));
} else {
  app.get('/', (_req, res) => res.type('text').send('bews API is running. Build the UI with `npm run build` to serve the app here.'));
}

app.listen(PORT, () => {
  console.log(`[bews] listening on http://localhost:${PORT} (db: ${DB_PATH})`);
  expireSummaryFallbacks();
  if (process.env.BEWS_NO_SCHEDULER !== '1') startScheduler();
});
