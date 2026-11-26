import type { Config } from '@netlify/functions';
import { synthesize, MAX_TTS_CHARS, type TtsLang } from '../../src/lib/tts-providers.ts';
import { json } from '../lib/data.ts';

/** On-demand TTS: MP3 for one word / phrase / sentence. GET responses are CDN-cacheable for a day. */
export default async (req: Request) => {
  let text = '';
  let lang: string | null = null;
  if (req.method === 'POST') {
    const body = (await req.json().catch(() => ({}))) as { text?: string; q?: string; lang?: string };
    text = String(body.text ?? body.q ?? '');
    lang = body.lang ?? null;
  } else {
    const u = new URL(req.url).searchParams;
    text = u.get('text') || u.get('q') || '';
    lang = u.get('lang');
  }
  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return json({ error: 'text_required' }, { status: 400 });
  if (lang !== 'en' && lang !== 'he') return json({ error: 'lang_must_be_en_or_he' }, { status: 400 });
  if (text.length > MAX_TTS_CHARS) return json({ error: 'text_too_long' }, { status: 413 });
  try {
    const r = await synthesize(text, lang as TtsLang);
    return new Response(r.audio as Uint8Array<ArrayBuffer>, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(r.audio.length),
        'Cache-Control': 'public, max-age=86400',
        'Netlify-CDN-Cache-Control': 'public, max-age=86400, durable',
        'X-TTS-Provider': r.provider,
        'Access-Control-Expose-Headers': 'X-TTS-Provider',
      },
    });
  } catch (e) {
    return json({ error: 'tts_failed', detail: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
};

export const config: Config = { path: '/api/tts' };
