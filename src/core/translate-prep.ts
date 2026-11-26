import type { NewsLang } from '../shared/types.ts';

export const PUNCT_EDGES = /^[\s"'“”„‘’«»()[\]{}.,;:!?…—–\-־׳״]+|[\s"'“”„‘’«»()[\]{}.,;:!?…—–\-־׳״]+$/gu;

export function detectLang(text: string): NewsLang {
  const he = (text.match(/[\u0590-\u05FF]/g) || []).length;
  const lat = (text.match(/[A-Za-z]/g) || []).length;
  return he > lat ? 'he' : 'en';
}

export function normalize(text: string, kind: 'word' | 'sentence'): string {
  let t = text.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (kind === 'word') t = t.replace(PUNCT_EDGES, '');
  return t.toLowerCase();
}

/** Shared request preparation: language, word-vs-sentence, display form and cache key. */
export function prepare(rawText: string, source: NewsLang | 'auto') {
  const text = rawText.replace(/\s+/g, ' ').trim();
  const src: NewsLang = source === 'auto' ? detectLang(text) : source;
  const kind: 'word' | 'sentence' = /\s/.test(text.replace(PUNCT_EDGES, '')) ? 'sentence' : 'word';
  const display = kind === 'word' ? text.replace(PUNCT_EDGES, '') || text : text;
  const key = normalize(text, kind) || text.toLowerCase();
  return { text, src, kind, display, key };
}
