import type { NewsLang } from '../shared/types.ts';

export interface Token { text: string; word: boolean }
export interface Sentence { text: string; tokens: Token[] }

const hasSeg = typeof Intl !== 'undefined' && 'Segmenter' in Intl;
const sentSeg = new Map<string, Intl.Segmenter>();
const wordSeg = new Map<string, Intl.Segmenter>();
const seg = (cache: Map<string, Intl.Segmenter>, lang: string, granularity: 'sentence' | 'word') => {
  let s = cache.get(lang);
  if (!s) { s = new Intl.Segmenter(lang, { granularity }); cache.set(lang, s); }
  return s;
};

const ABBREV_EN = /\b(Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|Gen|Lt|Col|Sgt|Capt|Gov|Sen|Rep|U\.S|U\.K|No|vs|etc|Inc|Ltd|Co|Corp)\.$/i;

export function splitSentences(paragraph: string, lang: NewsLang): string[] {
  let parts: string[];
  if (hasSeg) {
    parts = [...seg(sentSeg, lang, 'sentence').segment(paragraph)].map((s) => s.segment);
  } else {
    parts = paragraph.match(/[^.!?…]+(?:[.!?…]+["'”’»)]*\s*|$)/g) || [paragraph];
  }
  // Re-join splits after common abbreviations ("Mr. Smith") and tiny fragments.
  const out: string[] = [];
  for (const p of parts) {
    const prev = out[out.length - 1];
    if (prev !== undefined && (ABBREV_EN.test(prev.trim()) || p.trim().length < 3)) out[out.length - 1] = prev + p;
    else out.push(p);
  }
  return out.filter((s) => s.trim());
}

const HEB = /[\u0590-\u05FF]/;

export function tokenizeSentence(sentence: string, lang: NewsLang): Token[] {
  let toks: Token[];
  if (hasSeg) {
    toks = [...seg(wordSeg, lang, 'word').segment(sentence)].map((s) => ({ text: s.segment, word: !!s.isWordLike }));
  } else {
    toks = (sentence.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*|[^\p{L}\p{N}]+/gu) || []).map((t) => ({ text: t, word: /[\p{L}\p{N}]/u.test(t) }));
  }
  // Merge Hebrew acronyms/abbreviations: צה"ל, ארה״ב, ג'ירפה  →  one token.
  const merged: Token[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const prev = merged[merged.length - 1];
    const next = toks[i + 1];
    if (prev?.word && /^["״'׳]$/.test(t.text) && HEB.test(prev.text) && next?.word && HEB.test(next.text)) {
      prev.text += t.text + next.text;
      i++;
      continue;
    }
    // Keep English contractions / hyphenated words together: don't, well-known
    if (prev?.word && /^['’-]$/.test(t.text) && next?.word && !HEB.test(prev.text) && /^[A-Za-z]/.test(next.text)) {
      prev.text += t.text + next.text;
      i++;
      continue;
    }
    merged.push({ ...t });
  }
  return merged;
}

export function buildParagraphs(paragraphs: string[], lang: NewsLang): Sentence[][] {
  return paragraphs.map((p) => splitSentences(p, lang).map((s) => ({ text: s, tokens: tokenizeSentence(s, lang) })));
}

export const normWord = (w: string) => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
