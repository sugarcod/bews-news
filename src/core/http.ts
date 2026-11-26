export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Fetch a URL and decode it with the right charset (Hebrew sites sometimes use windows-1255). */
export const READER_UA = 'bews-news-reader/1.0 (+RSS reader; personal use)';

export async function fetchText(url: string, timeoutMs = 15_000, accept = '*/*'): Promise<{ text: string; finalUrl: string }> {
  const get = (ua: string) =>
    fetch(url, {
      headers: { 'User-Agent': ua, Accept: accept, 'Accept-Language': 'en-US,en;q=0.9,he;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
  let res = await get(BROWSER_UA);
  // Some CDNs (e.g. the Guardian's) reject browser-like UAs from servers but allow honest reader UAs.
  if (res.status === 403 || res.status === 401) res = await get(READER_UA);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let charset = /charset=([^;\s]+)/i.exec(res.headers.get('content-type') || '')?.[1];
  if (!charset) {
    const head = new TextDecoder('latin1').decode(buf.slice(0, 1024));
    charset = /encoding=["']([^"']+)["']/i.exec(head)?.[1] || /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  }
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder((charset || 'utf-8').toLowerCase().replace(/["']/g, ''));
  } catch {
    decoder = new TextDecoder('utf-8');
  }
  return { text: decoder.decode(buf), finalUrl: res.url || url };
}
