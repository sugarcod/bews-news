import { parseHTML } from 'linkedom';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', shy: '' };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

export function cleanText(s: string): string {
  return decodeEntities(s).replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim();
}

const BOILERPLATE = [
  /^(advertisement|sponsored|read more|related|subscribe|sign up|follow us|share this|click here)/i,
  /^the post .* appeared first on/i,
  /^(פרסומת|לכתבה המלאה|קראו עוד|הצטרפו|לחצו כאן|עקבו אחרינו)/,
  /(newsletter|cookie|all rights reserved|©)/i,
];

/** Turn an HTML fragment into clean, readable paragraphs. */
export function htmlToParagraphs(html: string): string[] {
  const { document } = parseHTML(`<!doctype html><html><body><div id="root">${html}</div></body></html>`);
  const root = document.getElementById('root');
  if (!root) return [];
  root.querySelectorAll('script,style,figure figcaption,iframe,noscript,form,button,aside,nav').forEach((n: Element) => n.remove());
  const blocks = root.querySelectorAll('p,h2,h3,h4,li,blockquote');
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const t = cleanText(raw);
    if (t.length < 25 && !/[.!?:]$/.test(t)) return;
    if (BOILERPLATE.some((re) => re.test(t))) return;
    if (seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  if (blocks.length) {
    blocks.forEach((b: Element) => {
      // skip containers whose text is already captured by a nested block
      if (b.querySelector('p,li,blockquote')) return;
      push(b.textContent || '');
    });
  }
  if (out.length === 0) {
    for (const line of stripHtml(html).split(/\n+/)) push(line);
  }
  return out;
}
