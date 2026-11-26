import type { Config } from '@netlify/functions';
import { TOPICS, type Topic } from '../../src/shared/types.ts';
import { json, loadArticles, toSummary } from '../lib/data.ts';

const list = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

function timeCutoff(t: string | null): number {
  if (t === 'today') { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.getTime() - 3 * 3600_000; }
  if (t === '2d') return Date.now() - 2 * 86400_000;
  if (t === 'week') return Date.now() - 7 * 86400_000;
  return 0;
}

export default async (req: Request) => {
  const u = new URL(req.url).searchParams;
  const { articles } = await loadArticles();
  const all = u.get('all') === '1';
  const days = Math.min(Number(u.get('days')) || 7, 3650);
  const since = Math.max(all ? 0 : Date.now() - days * 86400_000, timeCutoff(u.get('time')));
  const lang = u.get('lang');
  const topics = new Set(list(u.get('topic') || u.get('topics')).filter((t): t is Topic => (TOPICS as string[]).includes(t)));
  const sources = new Set(list(u.get('sources')));
  const exclude = new Set(list(u.get('exclude')));
  const q = (u.get('q') || '').trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const limit = Math.min(Number(u.get('limit')) || 800, 2000);

  let out = articles.filter(
    (a) =>
      a.publishedAt >= since &&
      (lang !== 'en' && lang !== 'he' ? true : a.lang === lang) &&
      (!topics.size || topics.has(a.topic)) &&
      (!sources.size || sources.has(a.sourceId)) &&
      !exclude.has(a.sourceId) &&
      (!words.length || words.every((w) => `${a.title} ${a.summary} ${a.topic}`.toLowerCase().includes(w))),
  );
  if (u.get('tab') !== 'top') out = out.sort((a, b) => b.publishedAt - a.publishedAt);
  return json(out.slice(0, limit).map(toSummary), { maxAge: 60 });
};

export const config: Config = { path: '/api/articles' };
