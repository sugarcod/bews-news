import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { fetchText } from './http.ts';
import { htmlToParagraphs, stripHtml, cleanText } from './text.ts';
import type { ArticleFull, NewsLang } from '../shared/types.ts';

export type Extraction = ArticleFull['extraction'];

function scriptRatioOk(paragraphs: string[], lang: NewsLang): boolean {
  // Guard against extracting a cookie wall / wrong-language shell page.
  const text = paragraphs.join(' ');
  if (text.length < 200) return false;
  if (lang === 'he') return (text.match(/[\u0590-\u05FF]/g) || []).length / text.length > 0.3;
  return (text.match(/[A-Za-z]/g) || []).length / text.length > 0.4;
}

export async function readability(url: string, lang: NewsLang, title: string, timeoutMs = 15_000): Promise<string[] | null> {
  const { text: html } = await fetchText(url, timeoutMs, 'text/html,application/xhtml+xml');
  const { document } = parseHTML(html);
  const parsed = new Readability(document as unknown as Document, { charThreshold: 300 }).parse();
  if (!parsed?.content) return null;
  const t = cleanText(title);
  const paragraphs = htmlToParagraphs(parsed.content).filter((p) => p !== t);
  if (!scriptRatioOk(paragraphs, lang) || paragraphs.length < 2) return null;
  return paragraphs.slice(0, 80);
}

/**
 * Full text for an article: RSS full content → Mozilla Readability on the page → RSS summary.
 */
export async function extractArticle(
  a: { url: string; lang: NewsLang; title: string; summary: string; rssContent?: string | null },
  timeoutMs = 15_000,
): Promise<{ paragraphs: string[]; extraction: Extraction }> {
  let paragraphs: string[] | null = null;
  let extraction: Extraction = 'summary';
  if (a.rssContent) {
    const p = htmlToParagraphs(a.rssContent);
    if (p.length >= 2) { paragraphs = p; extraction = 'rss-content'; }
  }
  if (!paragraphs || paragraphs.join(' ').length < 900) {
    try {
      const p = await readability(a.url, a.lang, a.title, timeoutMs);
      if (p && (!paragraphs || p.join(' ').length > paragraphs.join(' ').length)) { paragraphs = p; extraction = 'readability'; }
    } catch (e) {
      console.warn(`[extract] ${a.url}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!paragraphs) {
    const s = a.summary || stripHtml(a.rssContent || '');
    paragraphs = s ? s.split(/\n+/).map(cleanText).filter(Boolean) : [];
    extraction = 'summary';
  }
  return { paragraphs, extraction };
}
