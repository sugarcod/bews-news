# bews news

English + Hebrew news wire (13 RSS feeds) with tap-to-translate into Russian,
phrase selection, on-demand sentence translation and a personal vocabulary with
Anki-ready CSV export. Installable PWA (Android Chrome / desktop).

## Stack
- **UI:** Vite + React 19 + TypeScript + Tailwind CSS 3 (`src/client`)
- **Server:** Node ≥ 22.18 running TypeScript natively (type stripping) + Express 5 (`src/server`)
- **DB:** built-in `node:sqlite` → `data/bews.db` (articles, translation cache, vocabulary, bookmarks)
- **RSS:** `rss-parser`; full text via `@mozilla/readability` + `linkedom` (falls back to RSS content / summary)
- **Translation:** `src/lib/translator.ts` — provider chain with automatic fallback and a per-provider cooldown

## Run
```bash
npm install
npm run build          # typecheck (client + server) + vite build → dist/
npm start              # http://localhost:3000  (PORT=… to change)
```
Dev mode: `npm run dev:server` + `npm run dev:client` (Vite on :5173 proxies `/api`).

RSS sync runs on startup and every 30 min (`REFRESH_INTERVAL_MIN`). Manual: `POST /api/refresh`.

## Translation providers
Default needs no key or card:
1. `google-free` — `translate.googleapis.com/translate_a/single?client=gtx`
2. `google-web` — Google's web-widget endpoint (used automatically when Google rate-limits the gtx endpoint for your IP)
3. `google-dict`, `mymemory` — last-resort free fallbacks

Set any of these env vars to put an official API first:
`AZURE_TRANSLATOR_KEY` (+ `AZURE_TRANSLATOR_REGION`), `GOOGLE_TRANSLATE_API_KEY`, `DEEPL_API_KEY`.
Force one with `TRANSLATOR_PROVIDER=azure|google|deepl|google-free|google-web`.

Every word/sentence translation is cached in SQLite keyed by
`(source_lang, target_lang, normalized_text)`; repeat lookups return `cached: true`.

## API
| Method | Path | |
|---|---|---|
| GET | `/api/articles?days=7&q=&all=1&lang=` | article list |
| GET | `/api/articles/:id` | full text (extracted on demand, cached) |
| GET/POST | `/api/refresh` | pull all 13 feeds now |
| POST | `/api/translate` `{text, source: en\|he, target: ru}` | cached translation |
| GET/POST/DELETE | `/api/vocab`, `/api/vocab/:id` | vocabulary |
| GET | `/api/vocab/export.csv` | `word,translation,context,language,source` |
| GET/POST/DELETE | `/api/bookmarks`, `/api/bookmarks/:id` | saved stories |
| GET | `/api/sources`, `/api/stats` | feed status, cache stats |

## Previews
`npm run screenshots` (server must be running) → `previews/*.png` at 390×844.

## Online deployment (GitHub Actions + Netlify, zero build minutes)
- **`.github/workflows/sync-rss.yml`** runs hourly (and on demand): `scripts/sync-feeds-static.ts`
  fetches the 13 feeds, classifies topics, extracts full text for recent stories and force-pushes
  `articles.json` + `meta.json` to the orphan **`data`** branch (so `main` never changes and nothing rebuilds).
- **Netlify Functions** (`netlify/functions`) serve `/api/articles`, `/api/articles/:id`, `/api/translate`,
  `/api/refresh`, `/api/sources`, `/api/stats`, reading `https://raw.githubusercontent.com/<repo>/data/articles.json`
  (falls back to a live RSS fetch).
- The Netlify build (`VITE_STATIC=1`) keeps vocabulary, bookmarks and the translation cache in the
  browser's `localStorage`; the local Express build keeps them in SQLite.
- Deploy from your machine: `npm run deploy` (builds `dist-netlify/`, bundles functions, `netlify deploy --prod`).
- Optional Netlify env vars: `GOOGLE_WEB_KEY`, `AZURE_TRANSLATOR_KEY`, `GOOGLE_TRANSLATE_API_KEY`, `DEEPL_API_KEY`.

## Text-to-speech (on demand)
Tap 🔊 next to a headline, sentence, word/phrase or vocabulary card. Audio is synthesized only then
(`GET /api/tts?lang=en|he&text=…` → `audio/mpeg`, header `X-TTS-Provider`), cached in the browser's
Cache API (`bews-tts-v1`), and falls back to `speechSynthesis` when offline.
Provider chain (`src/lib/tts-providers.ts`): Azure Speech (`AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`)
→ Microsoft Edge neural voices (`en-US-AriaNeural`, `he-IL-HilaNeural`, free) → Google Translate TTS (chunked).
