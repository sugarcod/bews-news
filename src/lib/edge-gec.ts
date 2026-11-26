/**
 * Sec-MS-GEC v2 token for Microsoft Edge's free "Read aloud" TTS endpoint.
 * Ported from msedge-tts (MIT, © 2023 Migushthe2nd, https://github.com/Migushthe2nd/MsEdgeTTS),
 * which worked it out from https://github.com/rany2/edge-tts/pull/492.
 */
const EDGE_COPYRIGHT = 'Copyright (C) Microsoft Corporation. All rights reserved.';
const SWAP_FIRST_WORD = { swappedWord: 0xef0569fb, swappedSum: 0x76f50f34, swappedProduct: 0xc3efea97 };
const SWAP_SECOND_WORD = { swappedWord: 0xc31713db, swappedSum: 0x1881ce3c, swappedProduct: 0x35bd1ec9 };
const MIX_FIRST_WORD = [0xcf98b111, 0x87085b9f, 0x12ceb96d, 0x257e1d83];
const MIX_SECOND_WORD = [0xa27416f5, 0xd38396ff, 0x7c932b89, 0xbfa49f69];

const swapHalves = (v: number) => ((v << 16) | (v >>> 16)) >>> 0;
const toUpperHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

function swapTerm(word: number, key: number, m: typeof SWAP_FIRST_WORD): number {
  const sum = Math.imul(word, key) + Math.imul(swapHalves(word), m.swappedWord);
  const product = Math.imul(swapHalves(sum), m.swappedSum) >>> 0;
  return (Math.imul(swapHalves(product), m.swappedProduct) + product) >>> 0;
}
function swapAndMultiply(value: number, multipliers: number[]): number {
  for (const mul of multipliers) value = Math.imul(swapHalves(value), mul) >>> 0;
  return value;
}
function cs64(message: Uint8Array, digest: Uint8Array): Uint8Array {
  const dv = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
  const firstKey = (dv.getUint32(0, true) | 1) >>> 0;
  const secondKey = (dv.getUint32(4, true) | 1) >>> 0;
  const padded = new Uint8Array(Math.ceil(message.length / 8) * 8);
  padded.set(message);
  const words = new DataView(padded.buffer);
  let swapSum = 0, lastSwap = 0, mix = 0, mixSum = 0;
  for (let off = 0; off < padded.length; off += 8) {
    const w1 = words.getUint32(off, true);
    const w2 = words.getUint32(off + 4, true);
    const s1 = swapTerm(w1, firstKey, SWAP_FIRST_WORD);
    lastSwap = swapTerm(w2, secondKey, SWAP_SECOND_WORD);
    swapSum = (swapSum + s1 + lastSwap) >>> 0;
    mix = swapAndMultiply(Math.imul(mix + w1, firstKey), MIX_FIRST_WORD);
    mixSum = (mixSum + mix) >>> 0;
    mix = swapAndMultiply(Math.imul(mix + w2, secondKey), MIX_SECOND_WORD);
    mixSum = (mixSum + mix) >>> 0;
  }
  const out = new Uint8Array(8);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, lastSwap ^ mix, true);
  ov.setUint32(4, swapSum ^ mixSum, true);
  return out;
}

export async function secMsGec(trustedClientToken: string, nowMs = Date.now()): Promise<string> {
  const ticks = Math.floor(nowMs / 1000) + 11644473600;
  const windowsTicks = (ticks - (ticks % 300)) * 10000000;
  const message = new TextEncoder().encode(EDGE_COPYRIGHT + `${windowsTicks}${trustedClientToken}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', message));
  return `${toUpperHex(cs64(message, digest))}-${toUpperHex(digest)}`;
}
