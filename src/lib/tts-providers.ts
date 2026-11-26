/**
 * Server-side text-to-speech provider chain (on demand only — nothing is pre-generated):
 *   1. Azure Speech (official)      — if AZURE_SPEECH_KEY + AZURE_SPEECH_REGION are set
 *   2. Microsoft Edge neural voices  — free, no key (en-US-AriaNeural / he-IL-HilaNeural)
 *   3. Google Translate TTS          — free, no key; long text is chunked and concatenated
 * Every provider returns MP3 bytes.
 */
import { randomUUID } from 'node:crypto';
import { secMsGec } from './edge-gec.ts';

export type TtsLang = 'en' | 'he';
export interface TtsResult { audio: Uint8Array; provider: string }
interface TtsProvider { name: string; isConfigured(): boolean; synth(text: string, lang: TtsLang): Promise<Uint8Array> }

export const VOICES: Record<TtsLang, { voice: string; locale: string }> = {
  en: { voice: process.env.TTS_VOICE_EN || 'en-US-AriaNeural', locale: 'en-US' },
  he: { voice: process.env.TTS_VOICE_HE || 'he-IL-HilaNeural', locale: 'he-IL' },
};
export const MAX_TTS_CHARS = 1500;

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
const ssml = (text: string, lang: TtsLang) =>
  `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${VOICES[lang].locale}'><voice name='${VOICES[lang].voice}'><prosody pitch='+0Hz' rate='${lang === 'he' ? '-5%' : '+0%'}' volume='+0%'>${escapeXml(text)}</prosody></voice></speak>`;

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ---------------------------------------------------------------- 1. Azure Speech
const azureSpeech: TtsProvider = {
  name: 'azure-speech',
  isConfigured: () => !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION),
  async synth(text, lang) {
    const res = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY!,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'bews-news',
      },
      body: ssml(text, lang),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`azure-speech HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  },
};

// ---------------------------------------------------------------- 2. Edge "Read aloud" (WebSocket)
const EDGE_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_VERSION = '143.0.3650.96';
const EDGE_MAJOR = EDGE_VERSION.split('.')[0];

const edgeNeural: TtsProvider = {
  name: 'edge-neural',
  isConfigured: () => typeof WebSocket !== 'undefined',
  async synth(text, lang) {
    const connId = randomUUID().replace(/-/g, '');
    const url =
      `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${EDGE_TOKEN}` +
      `&Sec-MS-GEC=${await secMsGec(EDGE_TOKEN)}&Sec-MS-GEC-Version=2-${EDGE_VERSION}&ConnectionId=${connId}`;
    // Node's (undici) WebSocket accepts extra handshake headers as a non-standard init option.
    const init = {
      headers: {
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${EDGE_MAJOR}.0.0.0 Safari/537.36 Edg/${EDGE_MAJOR}.0.0.0`,
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
      },
    };
    const ws = new WebSocket(url, init as unknown as string[]);
    ws.binaryType = 'arraybuffer';
    const chunks: Uint8Array[] = [];
    return new Promise<Uint8Array>((resolve, reject) => {
      let done = false;
      const finish = (err?: Error) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { ws.close(); } catch { /* ignore */ }
        if (err) reject(err);
        else if (!chunks.length) reject(new Error('edge-neural: no audio'));
        else resolve(concat(chunks));
      };
      const timer = setTimeout(() => finish(new Error('edge-neural: timeout')), 12_000);
      ws.onopen = () => {
        const ts = new Date().toString();
        ws.send(
          `X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
            '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}',
        );
        ws.send(`X-RequestId:${connId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n${ssml(text, lang)}`);
      };
      ws.onmessage = (e: MessageEvent) => {
        if (typeof e.data === 'string') {
          if (e.data.includes('Path:turn.end')) finish();
          return;
        }
        const buf = new Uint8Array(e.data as ArrayBuffer);
        if (buf.length < 2) return;
        const headLen = (buf[0] << 8) | buf[1];
        const head = new TextDecoder().decode(buf.subarray(2, 2 + headLen));
        if (head.includes('Path:audio')) {
          const body = buf.subarray(2 + headLen);
          if (body.length) chunks.push(body.slice());
        }
      };
      ws.onerror = () => finish(new Error('edge-neural: websocket error'));
      ws.onclose = (e: CloseEvent) => { if (!done) finish(chunks.length ? undefined : new Error(`edge-neural: closed ${e.code}`)); };
    });
  },
};

// ---------------------------------------------------------------- 3. Google Translate TTS
/** Split text into ≤max-char chunks on sentence punctuation, then commas, then spaces. */
export function chunkText(text: string, max = 180): string[] {
  const out: string[] = [];
  let rest = text.replace(/\s+/g, ' ').trim();
  while (rest.length > max) {
    const slice = rest.slice(0, max + 1);
    let cut = -1;
    for (const re of [/[.!?…:;](?=\s)[^.!?…:;]*$/u, /[,،—–](?=\s)[^,،—–]*$/u, /\s[^\s]*$/u]) {
      const m = re.exec(slice);
      if (m && m.index > max * 0.3) { cut = m.index + 1; break; }
    }
    if (cut < 0) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

const googleTts: TtsProvider = {
  name: 'google-tts',
  isConfigured: () => true,
  async synth(text, lang) {
    const chunks = chunkText(text, 180);
    const parts: Uint8Array[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const q = new URLSearchParams({ ie: 'UTF-8', client: 'tw-ob', tl: lang === 'he' ? 'iw' : 'en', q: chunks[i], total: String(chunks.length), idx: String(i), textlen: String(chunks[i].length) });
      const res = await fetch(`https://translate.google.com/translate_tts?${q}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36', Referer: 'https://translate.google.com/' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok || !/audio/.test(res.headers.get('content-type') || '')) throw new Error(`google-tts HTTP ${res.status}`);
      parts.push(new Uint8Array(await res.arrayBuffer()));
    }
    return concat(parts);
  },
};

const CHAIN = [azureSpeech, edgeNeural, googleTts];
const COOLDOWN_MS = 3 * 60_000;
const cooldown = new Map<string, number>();

export function ttsProviderInfo() {
  return CHAIN.filter((p) => p.isConfigured()).map((p) => p.name);
}

/** Synthesize with automatic fallback; a failing provider is skipped for a few minutes. */
export async function synthesize(rawText: string, lang: TtsLang): Promise<TtsResult> {
  const text = rawText.replace(/\s+/g, ' ').trim().slice(0, MAX_TTS_CHARS);
  if (!text) throw new Error('empty text');
  const errors: string[] = [];
  const now = Date.now();
  const chain = CHAIN.filter((p) => p.isConfigured());
  const healthy = chain.filter((p) => (cooldown.get(p.name) || 0) <= now);
  for (const p of healthy.length ? healthy : chain) {
    try {
      const audio = await p.synth(text, lang);
      if (audio.length < 200) throw new Error(`${p.name}: audio too short`);
      cooldown.delete(p.name);
      return { audio, provider: p.name };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      cooldown.set(p.name, Date.now() + COOLDOWN_MS);
    }
  }
  throw new Error(`All TTS providers failed: ${errors.join(' | ')}`);
}
