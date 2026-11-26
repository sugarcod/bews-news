import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = process.env.BEWS_DATA_DIR || resolve(ROOT, 'data');
mkdirSync(DATA_DIR, { recursive: true });
export const DB_PATH = resolve(DATA_DIR, 'bews.db');

export const db = new DatabaseSync(DB_PATH);
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  rss_content TEXT,
  source_id TEXT NOT NULL,
  lang TEXT NOT NULL,
  topic TEXT NOT NULL,
  categories TEXT NOT NULL DEFAULT '[]',
  image TEXT,
  published_at INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL,
  paragraphs TEXT,
  extraction TEXT,
  extracted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_articles_pub ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_lang ON articles(lang);

CREATE TABLE IF NOT EXISTS translations (
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  original TEXT NOT NULL,
  translation TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'sentence',
  alternatives TEXT,
  provider TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (source_lang, target_lang, normalized_text)
);

CREATE TABLE IF NOT EXISTS vocab (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL,
  translation TEXT NOT NULL,
  lang TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  article_title TEXT NOT NULL DEFAULT '',
  article_url TEXT NOT NULL DEFAULT '',
  article_id TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (lang, word)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  article_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS source_status (
  source_id TEXT PRIMARY KEY,
  last_fetched_at INTEGER,
  last_count INTEGER,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

export function getMeta(key: string): string | null {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}
export function setMeta(key: string, value: string): void {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}
