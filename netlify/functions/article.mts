import type { Config, Context } from '@netlify/functions';
import { extractArticle } from '../../src/core/extract.ts';
import { articleId } from '../../src/core/feed.ts';
import { detectLang } from '../../src/core/translate-prep.ts';
import type { ArticleFull } from '../../src/shared/types.ts';
import { json, loadArticles, toSummary } from '../lib/data.ts';

const extracted = new Map<string, Pick<ArticleFull, 'paragraphs' | 'extraction'>>();

export default async (req: Request, context: Context) => {
  const u = new URL(req.url);
  const id = context.params?.id || u.searchParams.get('id') || '';
  const url = u.searchParams.get('url') || '';
  const { articles } = await loadArticles();
  let a = articles.find((x) => x.id === id) || (url ? articles.find((x) => x.url === url) : undefined);
  if (!a && url && /^https?:\/\//.test(url)) {
    // Not in the data set (e.g. an old bookmark): extract straight from the URL.
    const title = u.searchParams.get('title') || '';
    a = { id: id || articleId(url), url, title, summary: '', sourceId: u.searchParams.get('source') || '', lang: (u.searchParams.get('lang') as 'en' | 'he') || detectLang(title), topic: 'General', image: null, publishedAt: Date.now() };
  }
  if (!a) return json({ error: 'not_found' }, { status: 404 });

  if (a.paragraphs?.length && a.extraction !== 'summary') {
    return json({ ...toSummary(a), paragraphs: a.paragraphs, extraction: a.extraction }, { maxAge: 3600 });
  }
  const hit = extracted.get(a.url);
  if (hit) return json({ ...toSummary(a), ...hit }, { maxAge: 3600 });
  const r = await extractArticle({ url: a.url, lang: a.lang, title: a.title, summary: a.summary }, 7000);
  if (r.extraction === 'summary' && a.paragraphs?.length) {
    return json({ ...toSummary(a), paragraphs: a.paragraphs, extraction: 'summary' }, { maxAge: 600 });
  }
  extracted.set(a.url, r);
  return json({ ...toSummary(a), ...r }, { maxAge: r.extraction === 'summary' ? 600 : 3600 });
};

export const config: Config = { path: ['/api/articles/:id', '/api/article/:id', '/api/article'] };
