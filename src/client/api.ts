import type { ArticleFull, ArticleSummary, NewsLang, SourceInfo, Stats, TranslateResult, VocabEntry } from '../shared/types.ts';

/**
 * Two backends share this client:
 *  - local Express + SQLite (default): vocabulary, bookmarks and the translation cache live in the DB;
 *  - static/Netlify (`VITE_STATIC=1`): the same data lives in localStorage on the device.
 */
export const STATIC = import.meta.env.VITE_STATIC === '1';

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error; } catch { /* ignore */ }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface RefreshReport { totals: { all: number; en: number; he: number }; newArticles: number; sources: { id: string; count: number; error?: string }[]; articles?: ArticleSummary[] }

// ---------------------------------------------------------------- localStorage store (static mode)
const K = { vocab: 'bews.vocab', bookmarks: 'bews.bookmarks', tcache: 'bews.tcache', live: 'bews.live' };
function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {
    // Quota exceeded: drop the oldest half of the translation cache and retry once.
    if (key !== K.tcache) {
      const c = read<Record<string, CacheEntry>>(K.tcache, {});
      const keys = Object.keys(c).sort((a, b) => c[a].t - c[b].t);
      for (const k of keys.slice(0, Math.ceil(keys.length / 2))) delete c[k];
      localStorage.setItem(K.tcache, JSON.stringify(c));
      localStorage.setItem(key, JSON.stringify(value));
    } else console.warn('localStorage full', e);
  }
}

type CacheEntry = Omit<TranslateResult, 'cached'> & { t: number };
const MAX_CACHE = 4000;

const bookmarkIds = () => new Set(read<ArticleSummary[]>(K.bookmarks, []).map((b) => b.id));
const markBookmarks = <T extends ArticleSummary>(list: T[]): T[] => {
  const ids = bookmarkIds();
  return list.map((a) => ({ ...a, bookmarked: ids.has(a.id) }));
};

/** Articles pulled by a manual refresh stay visible for 3h, until the hourly sync catches up. */
function mergeLive(list: ArticleSummary[]): ArticleSummary[] {
  const live = read<{ at: number; items: ArticleSummary[] }>(K.live, { at: 0, items: [] });
  if (!live.items.length || Date.now() - live.at > 3 * 3600_000) return list;
  const ids = new Set(list.map((a) => a.id));
  const extra = live.items.filter((a) => !ids.has(a.id));
  return extra.length ? [...list, ...extra].sort((a, b) => b.publishedAt - a.publishedAt) : list;
}

function normKey(text: string, source: NewsLang): string {
  return `${source}|ru|${text.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()}`;
}

function csvDownload(rows: VocabEntry[], lang?: string) {
  const cell = (s: string) => `"${String(s ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  const lines = ['word,translation,context,language,source'];
  for (const r of [...rows].sort((a, b) => a.createdAt - b.createdAt)) {
    const source = r.articleTitle && r.articleUrl ? `${r.articleTitle} — ${r.articleUrl}` : r.articleUrl || r.articleTitle;
    lines.push([r.word, r.translation, r.context, r.lang, source].map(cell).join(','));
  }
  const blob = new Blob(['\uFEFF' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bews-vocabulary${lang ? '-' + lang : ''}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---------------------------------------------------------------- API
export const api = {
  articles: async (opts: { days?: number; all?: boolean; q?: string } = {}) => {
    const p = new URLSearchParams();
    if (opts.days) p.set('days', String(opts.days));
    if (opts.all) p.set('all', '1');
    if (opts.q) p.set('q', opts.q);
    p.set('limit', '2000');
    const list = await j<ArticleSummary[]>(`/api/articles?${p}`);
    return STATIC ? markBookmarks(opts.q ? list : mergeLive(list)) : list;
  },
  article: async (id: string, hint?: ArticleSummary) => {
    const p = new URLSearchParams();
    if (hint) { p.set('url', hint.url); p.set('title', hint.title); p.set('lang', hint.lang); p.set('source', hint.sourceId); }
    const a = await j<ArticleFull>(`/api/articles/${encodeURIComponent(id)}${hint ? `?${p}` : ''}`);
    if (!STATIC) return a;
    // keep the client-side metadata (topic, source, time) when the server only had the URL
    const merged = hint && !a.sourceId ? { ...a, ...hint, paragraphs: a.paragraphs, extraction: a.extraction } : a;
    return { ...merged, bookmarked: bookmarkIds().has(id) };
  },
  sources: () => j<SourceInfo[]>('/api/sources'),
  refresh: async () => {
    const r = await j<RefreshReport>('/api/refresh', { method: 'POST' });
    if (STATIC && r.articles) write(K.live, { at: Date.now(), items: r.articles.filter((a) => Date.now() - a.publishedAt < 2 * 86400_000) });
    return r;
  },
  translate: async (text: string, source: NewsLang): Promise<TranslateResult> => {
    if (!STATIC) return j<TranslateResult>('/api/translate', { method: 'POST', body: JSON.stringify({ text, source, target: 'ru' }) });
    const key = normKey(text, source);
    const cache = read<Record<string, CacheEntry>>(K.tcache, {});
    const hit = cache[key];
    if (hit) { const { t: _t, ...rest } = hit; return { ...rest, cached: true }; }
    const r = await j<TranslateResult>('/api/translate', { method: 'POST', body: JSON.stringify({ text, source, target: 'ru' }) });
    const fresh = read<Record<string, CacheEntry>>(K.tcache, {});
    const { cached: _c, ...entry } = r;
    fresh[key] = { ...entry, t: Date.now() };
    const keys = Object.keys(fresh);
    if (keys.length > MAX_CACHE) for (const k of keys.sort((a, b) => fresh[a].t - fresh[b].t).slice(0, keys.length - MAX_CACHE)) delete fresh[k];
    write(K.tcache, fresh);
    return r;
  },
  vocab: async () => (STATIC ? read<VocabEntry[]>(K.vocab, []) : j<VocabEntry[]>('/api/vocab')),
  addVocab: async (v: Omit<VocabEntry, 'id' | 'createdAt'>): Promise<VocabEntry> => {
    if (!STATIC) return j<VocabEntry>('/api/vocab', { method: 'POST', body: JSON.stringify(v) });
    const list = read<VocabEntry[]>(K.vocab, []);
    const word = v.word.replace(/\s+/g, ' ').trim();
    const existing = list.find((x) => x.lang === v.lang && x.word === word);
    const entry: VocabEntry = { ...v, word, id: existing?.id ?? Date.now(), createdAt: existing?.createdAt ?? Date.now() };
    write(K.vocab, [entry, ...list.filter((x) => x !== existing)]);
    return entry;
  },
  deleteVocab: async (id: number) => {
    if (!STATIC) return j<{ ok: boolean }>(`/api/vocab/${id}`, { method: 'DELETE' });
    write(K.vocab, read<VocabEntry[]>(K.vocab, []).filter((x) => x.id !== id));
    return { ok: true };
  },
  exportCsv: async (lang?: 'en' | 'he') => {
    if (!STATIC) { location.href = `/api/vocab/export.csv${lang ? `?lang=${lang}` : ''}`; return; }
    csvDownload(read<VocabEntry[]>(K.vocab, []).filter((v) => !lang || v.lang === lang), lang);
  },
  bookmarks: async () => (STATIC ? read<ArticleSummary[]>(K.bookmarks, []).map((a) => ({ ...a, bookmarked: true })) : j<ArticleSummary[]>('/api/bookmarks')),
  setBookmark: async (id: string, on: boolean, article?: ArticleSummary) => {
    if (!STATIC) return j<{ ok: boolean }>(`/api/bookmarks/${encodeURIComponent(id)}`, { method: on ? 'POST' : 'DELETE' });
    const list = read<ArticleSummary[]>(K.bookmarks, []).filter((a) => a.id !== id);
    if (on && article) {
      const { id: aid, url, title, summary, sourceId, lang, topic, image, publishedAt } = article;
      list.unshift({ id: aid, url, title, summary, sourceId, lang, topic, image, publishedAt });
    }
    write(K.bookmarks, list);
    return { ok: true };
  },
  stats: async () => {
    const s = await j<Stats>('/api/stats');
    if (!STATIC) return s;
    const cache = Object.values(read<Record<string, CacheEntry>>(K.tcache, {}));
    return {
      ...s,
      translations: cache.length,
      translationsWords: cache.filter((c) => c.kind === 'word').length,
      translationsSentences: cache.filter((c) => c.kind !== 'word').length,
      vocab: read<VocabEntry[]>(K.vocab, []).length,
      bookmarks: read<ArticleSummary[]>(K.bookmarks, []).length,
    };
  },
};

/** In-memory memo so re-opening a sentence/word never hits the network twice in a session. */
const memo = new Map<string, Promise<TranslateResult>>();
export function translateMemo(text: string, source: NewsLang): Promise<TranslateResult> {
  const key = `${source}|${text.trim().toLowerCase()}`;
  let p = memo.get(key);
  if (!p) {
    p = api.translate(text, source).catch((e) => { memo.delete(key); throw e; });
    memo.set(key, p);
  }
  return p;
}
