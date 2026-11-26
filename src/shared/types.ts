export type NewsLang = 'en' | 'he';
export type Topic = 'Politics' | 'Economy' | 'Tech' | 'Security' | 'Health' | 'Culture' | 'World' | 'General';
export const TOPICS: Topic[] = ['Politics', 'Economy', 'Tech', 'Security', 'Health', 'Culture', 'World', 'General'];

export interface SourceInfo {
  id: string;
  name: string;
  url: string;
  lang: NewsLang;
  topic: Topic;
  region: 'israel' | 'world';
  color: string;
  monogram: string;
  site: string;
  lastFetchedAt?: number | null;
  lastCount?: number | null;
  lastError?: string | null;
  articleCount?: number;
}

export interface ArticleSummary {
  id: string;
  url: string;
  title: string;
  summary: string;
  sourceId: string;
  lang: NewsLang;
  topic: Topic;
  image: string | null;
  publishedAt: number;
  bookmarked?: boolean;
}

export interface ArticleFull extends ArticleSummary {
  paragraphs: string[];
  extraction: 'readability' | 'rss-content' | 'summary';
}

export interface TranslateResult {
  original: string;
  translation: string;
  source: NewsLang;
  target: string;
  provider: string;
  cached: boolean;
  kind: 'word' | 'sentence';
  alternatives?: { pos: string; terms: string[] }[];
}

export interface VocabEntry {
  id: number;
  word: string;
  translation: string;
  lang: NewsLang;
  context: string;
  articleTitle: string;
  articleUrl: string;
  articleId: string | null;
  createdAt: number;
}

export interface Stats {
  articles: number;
  articlesEn: number;
  articlesHe: number;
  extracted: number;
  translations: number;
  translationsWords: number;
  translationsSentences: number;
  vocab: number;
  bookmarks: number;
  lastRefreshAt: number | null;
  nextRefreshAt: number | null;
  refreshIntervalMin: number;
  refreshing: boolean;
  provider: { active: string; configured: string[]; fallbacks: string[] };
}
