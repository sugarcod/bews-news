/**
 * Translation provider abstraction.
 *
 * Default provider ("google-free") needs no key or card: it calls the public
 * translate.googleapis.com `client=gtx` endpoint from the server.
 * Official providers are enabled simply by setting an env var:
 *   AZURE_TRANSLATOR_KEY (+ optional AZURE_TRANSLATOR_REGION)
 *   GOOGLE_TRANSLATE_API_KEY
 *   DEEPL_API_KEY
 * Force a specific one with TRANSLATOR_PROVIDER=azure|google|deepl|google-free.
 * If the active provider fails, the next ones in the chain are tried
 * (configured providers → google-free → google-web → google-dict → mymemory).
 * A provider that keeps failing (e.g. Google answering 429/"Sorry" for this IP)
 * is skipped for a few minutes so lookups stay fast.
 */

export type Lang = 'en' | 'he' | 'ru' | 'auto';

export interface TranslationOutput {
  text: string;
  alternatives?: { pos: string; terms: string[] }[];
}

export interface TranslationProvider {
  readonly name: string;
  readonly official: boolean;
  isConfigured(): boolean;
  translate(text: string, from: Lang, to: Lang, opts: { word: boolean }): Promise<TranslationOutput>;
}

const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const TIMEOUT_MS = 10_000;

export class TranslationError extends Error {
  readonly provider: string;
  readonly status?: number;
  constructor(provider: string, message: string, status?: number) {
    super(`[${provider}] ${message}`);
    this.provider = provider;
    this.status = status;
  }
}

async function fetchJson(provider: string, url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new TranslationError(provider, `HTTP ${res.status} ${body.slice(0, 160)}`, res.status);
  }
  return res.json();
}

/** Google's legacy code for Hebrew is `iw`; the newer APIs accept `he`. */
const gLang = (l: Lang) => (l === 'he' ? 'iw' : l);

// ---------------------------------------------------------------------------
// 1. Free Google endpoint (default, no key)
// ---------------------------------------------------------------------------
export const googleFree: TranslationProvider = {
  name: 'google-free',
  official: false,
  isConfigured: () => true,
  async translate(text, from, to, { word }) {
    const params = new URLSearchParams({ client: 'gtx', sl: gLang(from), tl: gLang(to), dj: '0' });
    params.append('dt', 't');
    if (word) params.append('dt', 'bd');
    // POST keeps long sentences out of the URL length limit.
    const data = (await fetchJson('google-free', `https://translate.googleapis.com/translate_a/single?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ q: text }).toString(),
    })) as unknown[];
    if (!Array.isArray(data) || !Array.isArray(data[0])) throw new TranslationError('google-free', 'unexpected response shape');
    const out = (data[0] as unknown[][])
      .map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
      .join('')
      .trim();
    if (!out) throw new TranslationError('google-free', 'empty translation');
    let alternatives: TranslationOutput['alternatives'];
    if (word && Array.isArray(data[1])) {
      alternatives = (data[1] as unknown[][])
        .filter((d) => Array.isArray(d) && typeof d[0] === 'string' && Array.isArray(d[1]))
        .map((d) => ({ pos: String(d[0]), terms: (d[1] as unknown[]).map(String).slice(0, 6) }))
        .slice(0, 4);
    }
    return { text: out, alternatives };
  },
};

// 1b. Google's web-widget endpoint (translate-pa). Free, no account needed; it uses the
// public browser key of Google's translate web widget, supplied via GOOGLE_WEB_KEY
// (kept out of the repo). Works from IPs where the gtx endpoint is rate-limited.
export const googleWeb: TranslationProvider = {
  name: 'google-web',
  official: false,
  isConfigured: () => !!process.env.GOOGLE_WEB_KEY,
  async translate(text, from, to, { word }) {
    const params = new URLSearchParams({
      'params.client': 'gtx',
      'query.source_language': from === 'auto' ? 'auto' : gLang(from),
      'query.target_language': gLang(to),
      'query.display_language': 'en-US',
      key: process.env.GOOGLE_WEB_KEY!,
      'query.text': text,
    });
    params.append('data_types', 'TRANSLATION');
    if (word) params.append('data_types', 'BILINGUAL_DICTIONARY_FULL');
    const data = (await fetchJson('google-web', `https://translate-pa.googleapis.com/v1/translate?${params}`)) as {
      translation?: string;
      bilingualDictionary?: { pos?: string; entry?: { word?: string }[] }[];
    };
    const out = data.translation?.trim();
    if (!out) throw new TranslationError('google-web', 'empty translation');
    const alternatives = (data.bilingualDictionary || [])
      .map((d) => ({ pos: d.pos || '', terms: (d.entry || []).map((e) => e.word || '').filter(Boolean).slice(0, 6) }))
      .filter((d) => d.terms.length)
      .slice(0, 4);
    return { text: out, alternatives: alternatives.length ? alternatives : undefined };
  },
};

// 1c. Second free Google endpoint used by the Chrome dictionary extension.
export const googleDict: TranslationProvider = {
  name: 'google-dict',
  official: false,
  isConfigured: () => true,
  async translate(text, from, to) {
    const params = new URLSearchParams({ client: 'dict-chrome-ex', sl: gLang(from), tl: gLang(to), q: text });
    const data = (await fetchJson('google-dict', `https://clients5.google.com/translate_a/t?${params}`)) as unknown;
    // Shapes seen in the wild: ["перевод"], [["перевод","en"]], {sentences:[{trans}]}
    let out = '';
    if (Array.isArray(data)) {
      const first = data[0];
      out = Array.isArray(first) ? String(first[0] ?? '') : String(first ?? '');
    } else if (data && typeof data === 'object' && Array.isArray((data as { sentences?: unknown[] }).sentences)) {
      out = ((data as { sentences: { trans?: string }[] }).sentences).map((s) => s.trans || '').join('');
    }
    out = out.trim();
    if (!out) throw new TranslationError('google-dict', 'empty translation');
    return { text: out };
  },
};

// 1d. MyMemory — free, no key, last-resort fallback.
export const myMemory: TranslationProvider = {
  name: 'mymemory',
  official: false,
  isConfigured: () => true,
  async translate(text, from, to) {
    const params = new URLSearchParams({ q: text.slice(0, 500), langpair: `${from === 'auto' ? 'en' : from}|${to}` });
    const data = (await fetchJson('mymemory', `https://api.mymemory.translated.net/get?${params}`)) as {
      responseStatus?: number;
      responseData?: { translatedText?: string };
    };
    const out = data.responseData?.translatedText?.trim();
    if (!out || (data.responseStatus && data.responseStatus !== 200)) throw new TranslationError('mymemory', 'no translation');
    return { text: out };
  },
};

// ---------------------------------------------------------------------------
// 2. Official providers (enabled via env vars)
// ---------------------------------------------------------------------------
export const azure: TranslationProvider = {
  name: 'azure',
  official: true,
  isConfigured: () => !!process.env.AZURE_TRANSLATOR_KEY,
  async translate(text, from, to, { word }) {
    const key = process.env.AZURE_TRANSLATOR_KEY!;
    const region = process.env.AZURE_TRANSLATOR_REGION || 'global';
    const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com';
    const headers: Record<string, string> = { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/json' };
    if (region !== 'global') headers['Ocp-Apim-Subscription-Region'] = region;
    const q = new URLSearchParams({ 'api-version': '3.0', to });
    if (from !== 'auto') q.set('from', from);
    const data = (await fetchJson('azure', `${endpoint}/translate?${q}`, {
      method: 'POST',
      headers,
      body: JSON.stringify([{ Text: text }]),
    })) as { translations: { text: string }[] }[];
    const out = data?.[0]?.translations?.[0]?.text?.trim();
    if (!out) throw new TranslationError('azure', 'empty translation');
    let alternatives: TranslationOutput['alternatives'];
    if (word && from !== 'auto') {
      // Bilingual dictionary lookup — gives part-of-speech grouped alternatives.
      try {
        const d = (await fetchJson('azure', `${endpoint}/dictionary/lookup?api-version=3.0&from=${from}&to=${to}`, {
          method: 'POST',
          headers,
          body: JSON.stringify([{ Text: text }]),
        })) as { translations: { posTag: string; displayTarget: string }[] }[];
        const groups = new Map<string, string[]>();
        for (const t of d?.[0]?.translations || []) {
          const arr = groups.get(t.posTag) || [];
          arr.push(t.displayTarget);
          groups.set(t.posTag, arr);
        }
        alternatives = [...groups].map(([pos, terms]) => ({ pos: pos.toLowerCase(), terms: terms.slice(0, 6) }));
      } catch {
        /* dictionary is optional */
      }
    }
    return { text: out, alternatives };
  },
};

export const googleCloud: TranslationProvider = {
  name: 'google',
  official: true,
  isConfigured: () => !!process.env.GOOGLE_TRANSLATE_API_KEY,
  async translate(text, from, to) {
    const body: Record<string, string> = { q: text, target: to, format: 'text' };
    if (from !== 'auto') body.source = from;
    const data = (await fetchJson(
      'google',
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(process.env.GOOGLE_TRANSLATE_API_KEY!)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    )) as { data?: { translations?: { translatedText: string }[] } };
    const out = data.data?.translations?.[0]?.translatedText?.trim();
    if (!out) throw new TranslationError('google', 'empty translation');
    return { text: out };
  },
};

export const deepl: TranslationProvider = {
  name: 'deepl',
  official: true,
  isConfigured: () => !!process.env.DEEPL_API_KEY,
  async translate(text, from, to) {
    const key = process.env.DEEPL_API_KEY!;
    const host = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
    const body: Record<string, unknown> = { text: [text], target_lang: to.toUpperCase() };
    if (from !== 'auto') body.source_lang = from.toUpperCase();
    const data = (await fetchJson('deepl', `${host}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })) as { translations?: { text: string }[] };
    const out = data.translations?.[0]?.text?.trim();
    if (!out) throw new TranslationError('deepl', 'empty translation');
    return { text: out };
  },
};

const ALL: TranslationProvider[] = [azure, googleCloud, deepl, googleFree, googleWeb, googleDict, myMemory];

/** Ordered provider chain: forced/configured official ones first, then free fallbacks. */
export function providerChain(): TranslationProvider[] {
  const forced = (process.env.TRANSLATOR_PROVIDER || '').trim().toLowerCase();
  const chain: TranslationProvider[] = [];
  const forcedP = ALL.find((p) => p.name === forced && p.isConfigured());
  if (forcedP) chain.push(forcedP);
  for (const p of ALL) if (p.official && p.isConfigured() && !chain.includes(p)) chain.push(p);
  for (const p of ALL) if (!p.official && p.isConfigured() && !chain.includes(p)) chain.push(p);
  return chain;
}

export function providerInfo() {
  const chain = providerChain();
  return {
    active: chain[0].name,
    configured: ALL.filter((p) => p.official && p.isConfigured()).map((p) => p.name),
    fallbacks: chain.slice(1).map((p) => p.name),
  };
}

const COOLDOWN_MS = 5 * 60_000;
const cooldownUntil = new Map<string, number>();

export interface TranslateCallResult extends TranslationOutput {
  provider: string;
}

/** Translate with automatic fallback through the provider chain. */
export async function translate(text: string, from: Lang, to: Lang, opts: { word: boolean }): Promise<TranslateCallResult> {
  const errors: string[] = [];
  const chain = providerChain();
  const now = Date.now();
  const healthy = chain.filter((p) => (cooldownUntil.get(p.name) || 0) <= now);
  for (const p of healthy.length ? healthy : chain) {
    try {
      const r = await p.translate(text, from, to, opts);
      cooldownUntil.delete(p.name);
      return { ...r, provider: p.name };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      cooldownUntil.set(p.name, Date.now() + COOLDOWN_MS);
    }
  }
  throw new Error(`All translation providers failed: ${errors.join(' | ')}`);
}
