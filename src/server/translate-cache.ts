import { db } from './db.ts';
import { translate } from '../lib/translator.ts';
import type { NewsLang, TranslateResult } from '../shared/types.ts';
import { prepare } from '../core/translate-prep.ts';

export { normalize, detectLang } from '../core/translate-prep.ts';

interface CacheRow { original: string; translation: string; provider: string; kind: string; alternatives: string | null }

const getStmt = db.prepare('SELECT original, translation, provider, kind, alternatives FROM translations WHERE source_lang = ? AND target_lang = ? AND normalized_text = ?');
const hitStmt = db.prepare('UPDATE translations SET hits = hits + 1 WHERE source_lang = ? AND target_lang = ? AND normalized_text = ?');
const putStmt = db.prepare(`INSERT INTO translations (source_lang, target_lang, normalized_text, original, translation, kind, alternatives, provider, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source_lang, target_lang, normalized_text) DO UPDATE SET translation = excluded.translation, provider = excluded.provider, alternatives = excluded.alternatives`);

const inflight = new Map<string, Promise<TranslateResult>>();

export async function cachedTranslate(rawText: string, source: NewsLang | 'auto', target = 'ru'): Promise<TranslateResult> {
  const { src, kind, display, key } = prepare(rawText, source);

  const hit = getStmt.get(src, target, key) as CacheRow | undefined;
  if (hit) {
    hitStmt.run(src, target, key);
    return {
      original: display, translation: hit.translation, source: src, target, provider: hit.provider, cached: true,
      kind: hit.kind === 'word' ? 'word' : 'sentence', alternatives: hit.alternatives ? JSON.parse(hit.alternatives) : undefined,
    };
  }
  const flightKey = `${src}|${target}|${key}`;
  const existing = inflight.get(flightKey);
  if (existing) return existing;
  const job = (async () => {
    const r = await translate(display, src, target as 'ru', { word: kind === 'word' });
    const alts = r.alternatives && r.alternatives.length ? r.alternatives : undefined;
    putStmt.run(src, target, key, display, r.text, kind, alts ? JSON.stringify(alts) : null, r.provider, Date.now());
    const res: TranslateResult = { original: display, translation: r.text, source: src, target, provider: r.provider, cached: false, kind, alternatives: alts };
    return res;
  })().finally(() => inflight.delete(flightKey));
  inflight.set(flightKey, job);
  return job;
}
