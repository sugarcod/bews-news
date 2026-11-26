import Parser from 'rss-parser';
import { createHash } from 'node:crypto';
import { classify } from './classify.ts';
import { fetchText } from './http.ts';
import { cleanText, stripHtml } from './text.ts';
import type { NewsLang, SourceInfo, Topic } from '../shared/types.ts';

type Item = Parser.Item & {
  'content:encoded'?: string;
  'media:content'?: { $?: { url?: string } } | { $?: { url?: string } }[];
  'media:thumbnail'?: { $?: { url?: string } };
  description?: string;
};

const parser: Parser<object, Item> = new Parser({
  customFields: { item: ['content:encoded', 'media:content', 'media:thumbnail', 'description'] },
});

export const articleId = (url: string) => createHash('sha1').update(url).digest('hex').slice(0, 16);

/** A parsed feed item, storage-agnostic (used by the Express server, the GitHub sync script and Netlify functions). */
export interface FeedArticle {
  id: string;
  url: string;
  title: string;
  summary: string;
  rssContent: string | null;
  sourceId: string;
  lang: NewsLang;
  topic: Topic;
  categories: string[];
  image: string | null;
  publishedAt: number;
}

function pickImage(item: Item): string | null {
  if (item.enclosure?.url && /image|\.(jpe?g|png|webp)/i.test(`${item.enclosure.type || ''} ${item.enclosure.url}`)) return item.enclosure.url;
  const mc = item['media:content'];
  const mcUrl = Array.isArray(mc) ? mc[0]?.$?.url : mc?.$?.url;
  if (mcUrl) return mcUrl;
  if (item['media:thumbnail']?.$?.url) return item['media:thumbnail'].$.url;
  const html = `${item['content:encoded'] || ''} ${item.description || item.content || ''}`;
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  return m ? m[1] : null;
}

function normCategories(item: Item): string[] {
  const raw = (item.categories || []) as unknown[];
  return raw
    .map((c) => (typeof c === 'string' ? c : (c as { _?: string })?._ || ''))
    .map((c) => cleanText(String(c)))
    .filter(Boolean)
    .slice(0, 10);
}

/** Offset of Asia/Jerusalem from UTC at a given instant (2h in winter, 3h in summer). */
function israelOffsetMs(ts: number): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', timeZoneName: 'shortOffset' }).formatToParts(new Date(ts));
  const m = /GMT([+-]\d+)/.exec(parts.find((p) => p.type === 'timeZoneName')?.value || '');
  return (m ? Number(m[1]) : 2) * 3600_000;
}

/** Fetch + parse one newsroom's feed. Throws on network/parse errors. */
export async function fetchFeed(src: SourceInfo, timeoutMs = 20_000): Promise<FeedArticle[]> {
  const now = Date.now();
  const { text } = await fetchText(src.url, timeoutMs, 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8');
  const feed = await parser.parseString(text.replace(/^\uFEFF/, '').trim());
  // Some Israeli feeds label Israel local time as "GMT". If any item is clearly in
  // the future, treat the whole feed as Asia/Jerusalem local time and shift it.
  const raw = feed.items.map((it) => Date.parse(it.isoDate || it.pubDate || ''));
  const maxTs = Math.max(...raw.filter(Number.isFinite), 0);
  const shift = maxTs > now + 20 * 60_000 ? israelOffsetMs(maxTs) : 0;
  const out: FeedArticle[] = [];
  const seen = new Set<string>();
  for (const item of feed.items.slice(0, 60)) {
    const url = (item.link || item.guid || '').trim();
    const title = cleanText(item.title || '');
    if (!url || !/^https?:/i.test(url) || !title || seen.has(url)) continue;
    seen.add(url);
    const contentHtml = item['content:encoded'] || '';
    const descHtml = item.description || item.content || '';
    let summary = cleanText(stripHtml(item.contentSnippet && item.contentSnippet.length > 20 ? item.contentSnippet : descHtml));
    summary = summary.replace(/The post .* appeared first on .*$/i, '').trim();
    if (summary === title) summary = '';
    if (summary.length > 600) summary = summary.slice(0, 597).replace(/\s+\S*$/, '') + '…';
    const categories = normCategories(item);
    const pub = Date.parse(item.isoDate || item.pubDate || '') - shift;
    const publishedAt = Number.isFinite(pub) ? Math.min(pub, now) : now;
    out.push({
      id: articleId(url),
      url,
      title,
      summary,
      // Only keep RSS bodies that are substantial (Geektime ships the full article).
      rssContent: stripHtml(contentHtml).length > 400 ? contentHtml : null,
      sourceId: src.id,
      lang: src.lang,
      topic: classify(title, summary, categories, src.lang, src.topic),
      categories,
      image: pickImage(item),
      publishedAt,
    });
  }
  return out;
}

export interface FeedResult { source: SourceInfo; items: FeedArticle[]; error?: string }

export async function fetchAllFeeds(sources: SourceInfo[], timeoutMs = 20_000): Promise<FeedResult[]> {
  return Promise.all(
    sources.map((s) =>
      fetchFeed(s, timeoutMs).then(
        (items) => ({ source: s, items }),
        (e) => ({ source: s, items: [], error: e instanceof Error ? e.message : String(e) }),
      ),
    ),
  );
}
