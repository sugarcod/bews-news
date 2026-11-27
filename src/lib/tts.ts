/**
 * Client-side TTS player (browser only).
 *  - audio is fetched on demand from /api/tts (never pre-generated),
 *  - cached in the Cache API ("bews-tts-v1") with an in-memory Map fallback,
 *  - one sound at a time: tapping the playing button stops it, tapping another stops the first,
 *  - falls back to window.speechSynthesis (en-US / he-IL) if /api/tts is unreachable.
 */
import { useSyncExternalStore } from 'react';

export type SpeakLang = 'en' | 'he';
export type SpeakState = 'idle' | 'loading' | 'playing';

const CACHE_NAME = 'bews-tts-v1';
const memory = new Map<string, Blob>();
const MAX_MEMORY = 120;

const normalize = (text: string) => text.normalize('NFC').replace(/\s+/g, ' ').trim();
export const ttsKey = (lang: SpeakLang, text: string) => `${lang}|${normalize(text).toLowerCase()}`;
const cacheUrl = (lang: SpeakLang, text: string) => `/__tts-cache/${lang}/${encodeURIComponent(normalize(text).toLowerCase())}`;
const hasCacheApi = () => typeof caches !== 'undefined' && window.isSecureContext;

async function cachedBlob(lang: SpeakLang, text: string): Promise<Blob | null> {
  const k = ttsKey(lang, text);
  const m = memory.get(k);
  if (m) return m;
  if (!hasCacheApi()) return null;
  try {
    const hit = await (await caches.open(CACHE_NAME)).match(cacheUrl(lang, text));
    if (!hit) return null;
    const blob = await hit.blob();
    remember(k, blob);
    return blob;
  } catch {
    return null;
  }
}
function remember(k: string, blob: Blob) {
  memory.set(k, blob);
  if (memory.size > MAX_MEMORY) memory.delete(memory.keys().next().value!);
}
async function store(lang: SpeakLang, text: string, blob: Blob) {
  remember(ttsKey(lang, text), blob);
  if (!hasCacheApi()) return;
  try {
    await (await caches.open(CACHE_NAME)).put(cacheUrl(lang, text), new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }));
  } catch { /* quota / private mode — memory cache still works */ }
}

async function fetchAudio(lang: SpeakLang, text: string, signal: AbortSignal): Promise<Blob> {
  const hit = await cachedBlob(lang, text);
  if (hit) return hit;
  const res = await fetch(`/api/tts?${new URLSearchParams({ lang, text: normalize(text) })}`, { signal });
  if (!res.ok || !/audio/.test(res.headers.get('content-type') || '')) throw new Error(`tts HTTP ${res.status}`);
  const blob = await res.blob();
  if (blob.size < 200) throw new Error('tts: empty audio');
  void store(lang, text, blob);
  return blob;
}

// ---------------------------------------------------------------- single global player
let current: { key: string; state: SpeakState } = { key: '', state: 'idle' };
let audio: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let abort: AbortController | null = null;
let token = 0;
const listeners = new Set<() => void>();
const emit = (key: string, state: SpeakState) => { current = { key, state }; listeners.forEach((l) => l()); };

/** Stop the current media (audio element / speechSynthesis) without touching UI state. */
function releaseMedia(): void {
  token++;
  abort?.abort();
  abort = null;
  if (audio) { audio.onended = null; audio.onerror = null; audio.pause(); audio.removeAttribute('src'); audio.load(); }
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/** Stop everything: single-item playback AND any full-article sequence. */
export function stopSpeaking(): void {
  releaseMedia();
  emit('', 'idle');
  if (seq.status !== 'idle') setSeq(IDLE_SEQ);
}

function browserUtterance(text: string, lang: SpeakLang): SpeechSynthesisUtterance | null {
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return null;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'he' ? 'he-IL' : 'en-US';
  const voice = speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang === 'he' ? 'he' : 'en-us'));
  if (voice) u.voice = voice;
  u.rate = 0.95;
  return u;
}

function speakWithBrowser(text: string, lang: SpeakLang, key: string, my: number): boolean {
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'he' ? 'he-IL' : 'en-US';
  const voice = speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang === 'he' ? 'he' : 'en-us'));
  if (voice) u.voice = voice;
  u.rate = 0.95;
  u.onend = u.onerror = () => { if (token === my) emit('', 'idle'); };
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  emit(key, 'playing');
  return true;
}

/** Toggle playback for (text, lang). Call directly from a click/tap handler. */
export function toggleSpeak(text: string, lang: SpeakLang): void {
  const key = ttsKey(lang, text);
  if (current.key === key && current.state !== 'idle') { stopSpeaking(); return; }
  stopSpeaking();
  const my = ++token;
  // Create/unlock the <audio> element synchronously inside the user gesture (Android Chrome autoplay rules).
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
  }
  const el = audio;
  el.muted = false;
  emit(key, 'loading');
  abort = new AbortController();
  fetchAudio(lang, text, abort.signal)
    .then(async (blob) => {
      if (token !== my) return;
      objectUrl = URL.createObjectURL(blob);
      el.src = objectUrl;
      el.onended = () => { if (token === my) stopSpeaking(); };
      el.onerror = () => { if (token === my && !speakWithBrowser(text, lang, key, my)) emit('', 'idle'); };
      await el.play();
      if (token === my) emit(key, 'playing');
    })
    .catch((e) => {
      if (token !== my || (e instanceof DOMException && e.name === 'AbortError')) return;
      console.warn('[tts] falling back to speechSynthesis:', e instanceof Error ? e.message : e);
      if (!speakWithBrowser(text, lang, key, my)) emit('', 'idle');
    });
}

export function getSpeakState(text: string, lang: SpeakLang): SpeakState {
  return current.key === ttsKey(lang, text) ? current.state : 'idle';
}

/** React hook: playback state of one (text, lang) button + a toggle callback. */
export function useSpeak(text: string, lang: SpeakLang): { state: SpeakState; toggle: () => void } {
  const key = ttsKey(lang, text);
  const state = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => (current.key === key ? current.state : 'idle'),
  );
  return { state, toggle: () => toggleSpeak(text, lang) };
}

// ---------------------------------------------------------------- full-article playback
export interface SeqItem { id: string; text: string; lang: SpeakLang }
export interface SeqState {
  /** owner id (article id) */
  owner: string;
  status: 'idle' | 'loading' | 'playing' | 'paused';
  index: number;
  total: number;
  itemId: string;
  text: string;
}
const IDLE_SEQ: SeqState = { owner: '', status: 'idle', index: 0, total: 0, itemId: '', text: '' };
let seq: SeqState = IDLE_SEQ;
let seqItems: SeqItem[] = [];
let seqViaBrowser = false;
const seqListeners = new Set<() => void>();
function setSeq(next: SeqState) { seq = next; seqListeners.forEach((l) => l()); }

function prefetch(item?: SeqItem) {
  if (!item) return;
  // Fire-and-forget: warms the Cache API so the next sentence starts instantly.
  fetchAudio(item.lang, item.text, new AbortController().signal).catch(() => {});
}

function playSeqIndex(i: number) {
  releaseMedia();
  const my = token;
  if (i >= seqItems.length) { setSeq(IDLE_SEQ); return; }
  const item = seqItems[i];
  setSeq({ ...seq, status: 'loading', index: i, itemId: item.id, text: item.text });
  const next = () => { if (token === my) playSeqIndex(i + 1); };
  if (!audio) audio = new Audio();
  const el = audio;
  abort = new AbortController();
  fetchAudio(item.lang, item.text, abort.signal)
    .then(async (blob) => {
      if (token !== my) return;
      objectUrl = URL.createObjectURL(blob);
      el.src = objectUrl;
      el.onended = next;
      el.onerror = next;
      seqViaBrowser = false;
      if (seq.status === 'paused') { prefetch(seqItems[i + 1]); return; } // paused while loading
      await el.play();
      if (token !== my) return;
      setSeq({ ...seq, status: 'playing' });
      prefetch(seqItems[i + 1]);
      prefetch(seqItems[i + 2]);
    })
    .catch((e) => {
      if (token !== my || (e instanceof DOMException && e.name === 'AbortError')) return;
      const u = browserUtterance(item.text, item.lang);
      if (!u) { next(); return; }
      seqViaBrowser = true;
      u.onend = next;
      u.onerror = next;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      if (seq.status === 'paused') speechSynthesis.pause();
      else setSeq({ ...seq, status: 'playing' });
    });
}

/** Play a list of items (headline + sentences) one after another. Call from a click handler. */
export function startSequence(owner: string, items: SeqItem[], from = 0): void {
  stopSpeaking();
  if (!items.length) return;
  if (!audio) { audio = new Audio(); audio.preload = 'auto'; } // unlock inside the user gesture
  seqItems = items;
  setSeq({ owner, status: 'loading', index: from, total: items.length, itemId: items[from].id, text: items[from].text });
  prefetch(items[from + 1]);
  playSeqIndex(from);
}

export function pauseSequence(): void {
  if (seq.status !== 'playing' && seq.status !== 'loading') return;
  if (seqViaBrowser) speechSynthesis.pause();
  else audio?.pause();
  setSeq({ ...seq, status: 'paused' });
}

export function resumeSequence(): void {
  if (seq.status !== 'paused') return;
  if (seqViaBrowser) { speechSynthesis.resume(); setSeq({ ...seq, status: 'playing' }); return; }
  if (audio && audio.src) {
    audio.play().then(() => setSeq({ ...seq, status: 'playing' })).catch(() => playSeqIndex(seq.index));
  } else playSeqIndex(seq.index);
}

/** Jump to another item while a sequence is running. */
export function seekSequence(index: number): void {
  if (seq.status === 'idle') return;
  playSeqIndex(Math.max(0, Math.min(index, seqItems.length - 1)));
}

export const stopSequence = stopSpeaking;

export function useSequence(): SeqState {
  return useSyncExternalStore(
    (cb) => { seqListeners.add(cb); return () => seqListeners.delete(cb); },
    () => seq,
  );
}
