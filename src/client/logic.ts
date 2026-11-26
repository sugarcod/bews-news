import type { ArticleSummary, NewsLang, SourceInfo, Topic } from '../shared/types.ts';
import { TOPICS } from '../shared/types.ts';

export type TimeRange = 'all' | 'today' | '2d' | 'week';
export interface Filters {
  lang: 'all' | NewsLang;
  time: TimeRange;
  topics: Topic[];
  disabled: string[];
  followed: string[];
}
export const DEFAULT_FILTERS: Filters = { lang: 'all', time: 'all', topics: [], disabled: [], followed: [] };

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...fallback, ...JSON.parse(v) } : fallback;
  } catch {
    return fallback;
  }
}

export function activeFilterCount(f: Filters): number {
  return (f.lang !== 'all' ? 1 : 0) + (f.time !== 'all' ? 1 : 0) + f.topics.length + (f.disabled.length ? 1 : 0);
}

function timeCutoff(t: TimeRange): number {
  const now = new Date();
  if (t === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (t === '2d') return Date.now() - 2 * 86400_000;
  if (t === 'week') return Date.now() - 7 * 86400_000;
  return 0;
}

export function applyFilters(list: ArticleSummary[], f: Filters): ArticleSummary[] {
  const cutoff = timeCutoff(f.time);
  const disabled = new Set(f.disabled);
  const topics = new Set(f.topics);
  return list.filter(
    (a) =>
      (f.lang === 'all' || a.lang === f.lang) &&
      a.publishedAt >= cutoff &&
      !disabled.has(a.sourceId) &&
      (topics.size === 0 || topics.has(a.topic)),
  );
}

export const shownTopics = (f: Filters): Topic[] => (f.topics.length ? TOPICS.filter((t) => f.topics.includes(t)) : TOPICS.filter((t) => t !== 'General'));

// ------------------------------------------------------------------ "Top" ranking
const STOP = new Set(
  ('the a an of to in on for and or but with from by at as is are was were be been has have had will would after before over into about than this that these those its it his her their they he she we you not new says said say amid more most what who how why when where israel israeli ' +
    'של את על עם לא כי גם זה זו הוא היא הם אם או אבל אחרי לפני בין כל יותר מה מי איך למה עוד רק כבר היה היו יש אין שלא אחד אחת').split(/\s+/),
);

function tokens(title: string): Set<string> {
  const out = new Set<string>();
  for (const raw of title.toLowerCase().split(/[^\p{L}\p{N}"״']+/u)) {
    let w = raw.replace(/['"״]/g, '');
    if (/[\u0590-\u05FF]/.test(w)) {
      if (w.length > 4 && /^[והבלמשכ]/.test(w)) w = w.slice(1); // strip one Hebrew prefix letter
      if (w.length < 3) continue;
    } else if (w.length < 4) continue;
    if (STOP.has(w)) continue;
    out.add(w.replace(/s$/, ''));
  }
  return out;
}

export interface Ranked {
  featured: { article: ArticleSummary; related: ArticleSummary[] } | null;
  list: ArticleSummary[];
}

export function rankTop(list: ArticleSummary[]): Ranked {
  const now = Date.now();
  const recent = list.filter((a) => now - a.publishedAt < 48 * 3600_000);
  const pool = recent.length >= 12 ? recent : list.slice(0, 200);
  const toks = new Map(pool.map((a) => [a.id, tokens(a.title)]));
  const related = new Map<string, ArticleSummary[]>();
  for (const a of pool) {
    const ta = toks.get(a.id)!;
    const rel: ArticleSummary[] = [];
    for (const b of pool) {
      if (b === a || b.lang !== a.lang || b.sourceId === a.sourceId) continue;
      if (Math.abs(b.publishedAt - a.publishedAt) > 36 * 3600_000) continue;
      let shared = 0;
      for (const t of toks.get(b.id)!) if (ta.has(t)) shared++;
      if (shared >= 2) rel.push(b);
    }
    related.set(a.id, rel);
  }
  const score = (a: ArticleSummary) => {
    const hours = (now - a.publishedAt) / 3600_000;
    const rel = new Set(related.get(a.id)!.map((r) => r.sourceId)).size;
    return (1 + rel * 1.6 + (a.image ? 0.15 : 0)) / Math.pow(hours + 2, 0.75);
  };
  const scored = pool.map((a) => ({ a, s: score(a) })).sort((x, y) => y.s - x.s);

  let featured: Ranked['featured'] = null;
  const cand = scored.find(({ a }) => related.get(a.id)!.length > 0 && now - a.publishedAt < 18 * 3600_000);
  if (cand) featured = { article: cand.a, related: related.get(cand.a.id)! };
  else if (scored[0]) featured = { article: scored[0].a, related: [] };

  // Greedy pick avoiding back-to-back stories from the same newsroom or the same cluster.
  const out: ArticleSummary[] = [];
  const used = new Set<string>(featured ? [featured.article.id, ...featured.related.map((r) => r.id)] : []);
  const remaining = scored.filter(({ a }) => !used.has(a.id)).map(({ a }) => a);
  while (remaining.length) {
    const last = out[out.length - 1];
    const prev = out[out.length - 2];
    // Bilingual wire: no more than two stories in a row in the same language
    // (when the other language is available), and no newsroom twice in a row.
    const streakLang = last && prev && last.lang === prev.lang ? last.lang : null;
    let idx = remaining.findIndex((a) => (!last || a.sourceId !== last.sourceId) && (!streakLang || a.lang !== streakLang) && remaining.indexOf(a) < 12);
    if (idx < 0) idx = remaining.findIndex((a) => !last || a.sourceId !== last.sourceId);
    if (idx < 0) idx = 0;
    const [pick] = remaining.splice(idx, 1);
    out.push(pick);
    // push its near-duplicates further down
    for (const r of related.get(pick.id) || []) {
      const i = remaining.indexOf(r);
      if (i >= 0 && i < 6) { remaining.splice(i, 1); remaining.push(r); }
    }
  }
  // Older items (beyond the 48h pool) follow chronologically.
  const inPool = new Set(pool.map((a) => a.id));
  for (const a of list) if (!inPool.has(a.id)) out.push(a);
  return { featured, list: out };
}

export function sourceMap(sources: SourceInfo[]): Map<string, SourceInfo> {
  return new Map(sources.map((s) => [s.id, s]));
}

export const TOPIC_COLORS: Record<Topic, string> = {
  Politics: '#A23526',
  Economy: '#2F7D5B',
  Tech: '#3D5FA8',
  Security: '#B4562B',
  Health: '#2C8C8C',
  Culture: '#8A4FA0',
  World: '#5B6B7A',
  General: '#8C8378',
};

export const isHebrew = (s: string) => /[\u0590-\u05FF]/.test(s);
