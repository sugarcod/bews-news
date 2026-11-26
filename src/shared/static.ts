import type { ArticleFull, ArticleSummary } from './types.ts';

/** One article in the static `articles.json` published to the `data` branch. */
export interface StaticArticle extends ArticleSummary {
  paragraphs?: string[];
  extraction?: ArticleFull['extraction'];
  extractedAt?: number;
}

export interface StaticSourceStatus { id: string; count: number; fetchedAt: number; error?: string | null }

export interface StaticMeta {
  version: 1;
  updatedAt: number;
  durationMs: number;
  counts: { all: number; en: number; he: number; extracted: number };
  sources: StaticSourceStatus[];
}

export interface StaticData { version: 1; updatedAt: number; articles: StaticArticle[] }
