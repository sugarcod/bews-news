import { createContext, useContext } from 'react';
import type { Topic } from '../shared/types.ts';

export type UiLang = 'ru' | 'en';

const en = {
  tabTop: 'Top', tabLatest: 'Latest', tabFollowing: 'Following',
  navWire: 'Wire', navVocab: 'Vocabulary', navSaved: 'Saved', navSettings: 'Settings',
  showing: 'Showing', showAll: 'Show All', allTopics: 'All topics',
  developing: 'Developing', topStories: 'Top stories right now', latestStories: 'Latest on the wire', followingStories: 'From your newsrooms',
  moreSources: 'more', sources: 'sources',
  emptyWire: 'Nothing on the wire for these filters.', emptyWireHint: 'Try widening the time range or picking more topics.',
  emptyFollowing: 'You are not following any newsroom yet.', emptyFollowingHint: 'Open Filters → Newsrooms and tap the star next to the outlets you like.',
  loading: 'Loading…', refreshing: 'Refreshing the wire…', refreshed: 'Wire refreshed', newStories: 'new stories', refreshFailed: 'Refresh failed',
  search: 'Search', filter: 'Filters', refresh: 'Refresh',
  // filter screen
  filterTitle: 'Filter the Wire', done: 'Done', wireWillShow: 'The wire will show', resetAll: 'Reset All',
  topicsTime: 'Topics & Time', newsrooms: 'Newsrooms', language: 'Language', all: 'All', english: 'English', hebrew: 'עברית',
  time: 'Time', allTime: 'All Time', today: 'Today', twoDays: '2 Days', thisWeek: 'This Week',
  topics: 'Topics', topicsHelp: 'Pick the desks you want on the wire. Nothing picked means all of them.',
  newsroomsHelp: 'Switch newsrooms on or off. Star the ones you follow — they fill the Following tab.',
  everything: 'Everything on the wire', storiesIn: 'stories in', fromAll: 'from all newsrooms', fromN: 'from {n} newsrooms',
  langAll: 'in English and Hebrew', langEn: 'in English', langHe: 'in Hebrew',
  timeAll: 'any time', timeToday: 'from today', time2d: 'from the last 2 days', timeWeek: 'from this week',
  follow: 'Follow', following: 'Following', articlesCount: 'stories', lastFetch: 'fetched', failed: 'failed',
  // search
  searchPlaceholder: 'Search headlines, topics, outlets', cancel: 'Cancel', searchingLast7: 'Searching the last 7 days', searchingAll: 'Searching the whole archive',
  searchAll: 'Search all', last7: 'Last 7 days', tryLabel: 'Try', noResults: 'No stories match', results: 'results',
  // reader
  back: 'Back', openOriginal: 'Open original', translateHeadline: 'Translate headline', translateSentence: 'Translate sentence', hideTranslation: 'Hide translation',
  readerHint: 'Tap any word for its translation, select a phrase, or tap ⟶ RU after a sentence.',
  extractedSummary: 'Showing the RSS summary — the site did not allow full-text extraction.', extractedRss: 'Full text from the RSS feed', extractedReadability: 'Full text extracted',
  addToVocab: 'Add to Vocabulary', addedToVocab: 'Saved to Vocabulary', inContext: 'Context', translating: 'Translating…', translationFailed: 'Translation failed. Try again.',
  fromCache: 'from cache', via: 'via', translateAll: 'Translate all', hideAll: 'Hide all', bookmark: 'Bookmark', bookmarked: 'Saved', retry: 'Retry',
  articleLoadFailed: 'Could not load this story.',
  // vocab
  vocabTitle: 'Vocabulary', vocabSubtitle: 'Words and phrases you saved while reading', exportCsv: 'Export CSV', exportHint: 'Anki-ready CSV: word, translation, context, language, source',
  searchVocab: 'Search your words', emptyVocab: 'Your vocabulary is empty.', emptyVocabHint: 'Open any story, tap a word and press “Add to Vocabulary”.', delete: 'Delete', fromArticle: 'From',
  words: 'words',
  // saved
  savedTitle: 'Saved', savedSubtitle: 'Stories you bookmarked', emptySaved: 'No saved stories yet.', emptySavedHint: 'Tap the bookmark on any story to keep it here.',
  // settings
  settingsTitle: 'Settings', interfaceLanguage: 'Interface language', refreshNow: 'Refresh RSS now', autoRefresh: 'Auto-refresh', every: 'every', minutes: 'min',
  lastRefresh: 'Last refresh', nextRefresh: 'Next refresh', never: 'never', cache: 'Cache & storage', cachedTranslations: 'Cached translations',
  wordsLabel: 'words', sentencesLabel: 'sentences', articlesLabel: 'Articles in database', fullTextCached: 'Full texts cached', vocabCount: 'Vocabulary entries', bookmarksCount: 'Bookmarks',
  provider: 'Translation provider', providerActive: 'Active', providerFallbacks: 'Fallbacks', providerHint: 'Set AZURE_TRANSLATOR_KEY, GOOGLE_TRANSLATE_API_KEY or DEEPL_API_KEY on the server to switch to an official API.',
  feedsStatus: 'Newsrooms status', about: 'bews news — EN/HE news wire with Russian translation on tap.', inMin: 'in {n} min',
  justNow: 'now', ago: 'ago',
  listen: 'Listen', stopAudio: 'Stop', loadingAudio: 'Loading audio…', listenHeadline: 'Listen to the headline', listenSentence: 'Listen to the sentence', listenWord: 'Listen',
};

type Dict = typeof en;

const ru: Dict = {
  tabTop: 'Главное', tabLatest: 'Свежее', tabFollowing: 'Подписки',
  navWire: 'Лента', navVocab: 'Словарь', navSaved: 'Закладки', navSettings: 'Настройки',
  showing: 'Показано', showAll: 'Показать всё', allTopics: 'Все темы',
  developing: 'Развивается', topStories: 'Главные новости сейчас', latestStories: 'Свежее в ленте', followingStories: 'Из ваших редакций',
  moreSources: 'ещё', sources: 'источников',
  emptyWire: 'По этим фильтрам новостей нет.', emptyWireHint: 'Расширьте период или выберите больше тем.',
  emptyFollowing: 'Вы пока не подписаны ни на одну редакцию.', emptyFollowingHint: 'Откройте Фильтры → Редакции и отметьте звёздочкой любимые издания.',
  loading: 'Загрузка…', refreshing: 'Обновляем ленту…', refreshed: 'Лента обновлена', newStories: 'новых', refreshFailed: 'Не удалось обновить',
  search: 'Поиск', filter: 'Фильтры', refresh: 'Обновить',
  filterTitle: 'Фильтры ленты', done: 'Готово', wireWillShow: 'Лента покажет', resetAll: 'Сбросить',
  topicsTime: 'Темы и время', newsrooms: 'Редакции', language: 'Язык', all: 'Все', english: 'English', hebrew: 'עברית',
  time: 'Время', allTime: 'Всё время', today: 'Сегодня', twoDays: '2 дня', thisWeek: 'Неделя',
  topics: 'Темы', topicsHelp: 'Выберите рубрики для ленты. Ничего не выбрано — показываются все.',
  newsroomsHelp: 'Включайте и отключайте редакции. Отмеченные звёздочкой попадают во вкладку «Подписки».',
  everything: 'Все новости ленты', storiesIn: 'новости в рубриках', fromAll: 'из всех редакций', fromN: 'из {n} редакций',
  langAll: 'на английском и иврите', langEn: 'на английском', langHe: 'на иврите',
  timeAll: 'за всё время', timeToday: 'за сегодня', time2d: 'за последние 2 дня', timeWeek: 'за неделю',
  follow: 'Подписаться', following: 'Подписка', articlesCount: 'новостей', lastFetch: 'обновлено', failed: 'ошибка',
  searchPlaceholder: 'Заголовки, темы, издания', cancel: 'Отмена', searchingLast7: 'Поиск за последние 7 дней', searchingAll: 'Поиск по всему архиву',
  searchAll: 'Искать везде', last7: 'Только 7 дней', tryLabel: 'Попробуйте', noResults: 'Ничего не найдено', results: 'результатов',
  back: 'Назад', openOriginal: 'Оригинал', translateHeadline: 'Перевести заголовок', translateSentence: 'Перевести предложение', hideTranslation: 'Скрыть перевод',
  readerHint: 'Нажмите на слово для перевода, выделите фразу или нажмите ⟶ RU после предложения.',
  extractedSummary: 'Показано краткое описание из RSS — сайт не отдал полный текст.', extractedRss: 'Полный текст из RSS', extractedReadability: 'Полный текст статьи',
  addToVocab: 'В словарь', addedToVocab: 'Добавлено в словарь', inContext: 'Контекст', translating: 'Переводим…', translationFailed: 'Не удалось перевести. Попробуйте ещё раз.',
  fromCache: 'из кэша', via: 'через', translateAll: 'Перевести всё', hideAll: 'Скрыть всё', bookmark: 'В закладки', bookmarked: 'В закладках', retry: 'Повторить',
  articleLoadFailed: 'Не удалось загрузить новость.',
  vocabTitle: 'Словарь', vocabSubtitle: 'Слова и фразы, сохранённые при чтении', exportCsv: 'Экспорт CSV', exportHint: 'CSV для Anki: слово, перевод, контекст, язык, источник',
  searchVocab: 'Поиск по словарю', emptyVocab: 'Словарь пока пуст.', emptyVocabHint: 'Откройте новость, нажмите на слово и выберите «В словарь».', delete: 'Удалить', fromArticle: 'Из',
  words: 'слов',
  savedTitle: 'Закладки', savedSubtitle: 'Сохранённые новости', emptySaved: 'Закладок пока нет.', emptySavedHint: 'Нажмите на значок закладки у любой новости.',
  settingsTitle: 'Настройки', interfaceLanguage: 'Язык интерфейса', refreshNow: 'Обновить RSS сейчас', autoRefresh: 'Автообновление', every: 'каждые', minutes: 'мин',
  lastRefresh: 'Последнее обновление', nextRefresh: 'Следующее', never: 'ещё не было', cache: 'Кэш и хранилище', cachedTranslations: 'Переводов в кэше',
  wordsLabel: 'слов', sentencesLabel: 'предложений', articlesLabel: 'Новостей в базе', fullTextCached: 'Полных текстов в кэше', vocabCount: 'Записей в словаре', bookmarksCount: 'Закладок',
  provider: 'Сервис перевода', providerActive: 'Активный', providerFallbacks: 'Резервные', providerHint: 'Чтобы перейти на официальный API, задайте на сервере AZURE_TRANSLATOR_KEY, GOOGLE_TRANSLATE_API_KEY или DEEPL_API_KEY.',
  feedsStatus: 'Состояние редакций', about: 'bews news — лента новостей на английском и иврите с переводом на русский по нажатию.', inMin: 'через {n} мин',
  justNow: 'сейчас', ago: 'назад',
  listen: 'Прослушать', stopAudio: 'Остановить', loadingAudio: 'Загружаем аудио…', listenHeadline: 'Прослушать заголовок', listenSentence: 'Прослушать предложение', listenWord: 'Прослушать',
};

export const DICTS: Record<UiLang, Dict> = { en, ru };
export type TKey = keyof Dict;

const TOPIC_NAMES: Record<UiLang, Record<Topic, string>> = {
  en: { Politics: 'Politics', Economy: 'Economy', Tech: 'Tech', Security: 'Security', Health: 'Health', Culture: 'Culture', World: 'World', General: 'General' },
  ru: { Politics: 'Политика', Economy: 'Экономика', Tech: 'Технологии', Security: 'Безопасность', Health: 'Здоровье', Culture: 'Культура', World: 'Мир', General: 'Разное' },
};

const PLURALS: Record<UiLang, Record<'words' | 'sources' | 'results', string[]>> = {
  en: { words: ['word', 'words'], sources: ['source', 'sources'], results: ['result', 'results'] },
  ru: { words: ['слово', 'слова', 'слов'], sources: ['источник', 'источника', 'источников'], results: ['результат', 'результата', 'результатов'] },
};

export function plural(lang: UiLang, n: number, key: keyof (typeof PLURALS)['en']): string {
  const f = PLURALS[lang][key];
  if (lang === 'en') return `${n} ${n === 1 ? f[0] : f[1]}`;
  const m10 = n % 10, m100 = n % 100;
  const form = m10 === 1 && m100 !== 11 ? f[0] : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? f[1] : f[2];
  return `${n} ${form}`;
}

export interface I18n {
  lang: UiLang;
  pl: (n: number, key: 'words' | 'sources' | 'results') => string;
  t: (k: TKey, vars?: Record<string, string | number>) => string;
  topic: (t: Topic) => string;
  rel: (ts: number) => string;
  setLang: (l: UiLang) => void;
}

export function makeI18n(lang: UiLang, setLang: (l: UiLang) => void): I18n {
  const d = DICTS[lang];
  return {
    lang,
    setLang,
    pl: (n, key) => plural(lang, n, key),
    t: (k, vars) => {
      let s = d[k] ?? en[k] ?? k;
      if (vars) for (const [key, v] of Object.entries(vars)) s = s.replace(`{${key}}`, String(v));
      return s;
    },
    topic: (t) => TOPIC_NAMES[lang][t] || t,
    rel: (ts) => relTime(ts, lang),
  };
}

export function relTime(ts: number, lang: UiLang): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60_000);
  const u = lang === 'ru' ? { now: 'сейчас', m: 'м', h: 'ч', d: 'д' } : { now: 'now', m: 'm', h: 'h', d: 'd' };
  if (m < 1) return u.now;
  if (m < 60) return `${m}${u.m}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}${u.h}`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}${u.d}`;
  return new Date(ts).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short' });
}

export const I18nContext = createContext<I18n>(makeI18n('ru', () => {}));
export const useI18n = () => useContext(I18nContext);
