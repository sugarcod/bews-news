import type { Config } from '@netlify/functions';
import { translate } from '../../src/lib/translator.ts';
import { prepare } from '../../src/core/translate-prep.ts';
import type { NewsLang, TranslateResult } from '../../src/shared/types.ts';
import { json } from '../lib/data.ts';

// Warm-instance cache; the browser additionally keeps a persistent localStorage cache.
const memo = new Map<string, Omit<TranslateResult, 'cached'>>();

export default async (req: Request) => {
  let text = '';
  let source: NewsLang | 'auto' = 'auto';
  let target = 'ru';
  if (req.method === 'POST') {
    const body = (await req.json().catch(() => ({}))) as { text?: string; q?: string; source?: string; target?: string };
    text = String(body.text ?? body.q ?? '');
    if (body.source === 'en' || body.source === 'he') source = body.source;
    if (body.target) target = String(body.target).toLowerCase();
  } else {
    const u = new URL(req.url).searchParams;
    text = u.get('q') || u.get('text') || '';
    const s = u.get('source');
    if (s === 'en' || s === 'he') source = s;
    target = (u.get('target') || 'ru').toLowerCase();
  }
  text = text.trim();
  if (!text) return json({ error: 'text_required' }, { status: 400 });
  if (text.length > 4000) return json({ error: 'text_too_long' }, { status: 413 });
  if (!/^[a-z]{2}$/.test(target)) return json({ error: 'bad_target' }, { status: 400 });

  const { src, kind, display, key } = prepare(text, source);
  const cacheKey = `${src}|${target}|${key}`;
  const hit = memo.get(cacheKey);
  if (hit) return json({ ...hit, cached: true });
  try {
    const r = await translate(display, src, target as 'ru', { word: kind === 'word' });
    const res: Omit<TranslateResult, 'cached'> = {
      original: display, translation: r.text, source: src, target, provider: r.provider, kind,
      alternatives: r.alternatives && r.alternatives.length ? r.alternatives : undefined,
    };
    memo.set(cacheKey, res);
    if (memo.size > 5000) memo.delete(memo.keys().next().value!);
    return json({ ...res, cached: false });
  } catch (e) {
    return json({ error: 'translation_failed', detail: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
};

export const config: Config = { path: '/api/translate' };
