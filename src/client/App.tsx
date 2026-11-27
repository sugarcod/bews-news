import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ArticleSummary, SourceInfo, VocabEntry } from '../shared/types.ts';
import { I18nContext, makeI18n, type UiLang } from './i18n.ts';
import { api } from './api.ts';
import { DEFAULT_FILTERS, activeFilterCount, loadJSON, sourceMap, type Filters } from './logic.ts';
import { normWord } from './tokenize.ts';
import { BottomNav, type Tab } from './components/Chrome.tsx';
import { WireScreen } from './screens/Wire.tsx';
import { FilterScreen } from './screens/Filter.tsx';
import { SearchScreen } from './screens/Search.tsx';
import { Reader } from './screens/Reader.tsx';
import { VocabScreen } from './screens/Vocab.tsx';
import { SavedScreen } from './screens/Saved.tsx';
import { SettingsScreen } from './screens/Settings.tsx';
import { Footer } from './components/Footer.tsx';

// ---------------------------------------------------------------- hash router
// #/<tab>[/filter|/search|/a/<articleId>]...  — real history entries, so the
// Android back button closes overlays naturally.
type Layer = { kind: 'filter' } | { kind: 'search' } | { kind: 'article'; id: string };
const TABS: Tab[] = ['wire', 'vocab', 'saved', 'settings'];

function parseHash(): { tab: Tab; layers: Layer[] } {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const tab = (TABS.includes(parts[0] as Tab) ? parts.shift() : 'wire') as Tab;
  const layers: Layer[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'filter') layers.push({ kind: 'filter' });
    else if (parts[i] === 'search') layers.push({ kind: 'search' });
    else if (parts[i] === 'a' && parts[i + 1]) layers.push({ kind: 'article', id: decodeURIComponent(parts[++i]) });
  }
  return { tab, layers };
}
const toHash = (tab: Tab, layers: Layer[]) =>
  '#/' + [tab, ...layers.map((l) => (l.kind === 'article' ? `a/${encodeURIComponent(l.id)}` : l.kind))].join('/');

export default function App() {
  const [uiLang, setUiLang] = useState<UiLang>(() => (localStorage.getItem('bews.lang') as UiLang) || 'ru');
  const i18n = useMemo(() => makeI18n(uiLang, (l) => { setUiLang(l); localStorage.setItem('bews.lang', l); }), [uiLang]);
  useEffect(() => { document.documentElement.lang = uiLang; document.title = uiLang === 'ru' ? 'bews news — лента' : 'bews news — wire'; }, [uiLang]);

  const [route, setRoute] = useState(parseHash);
  const pushes = useRef(0);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (tab: Tab, layers: Layer[]) => { pushes.current++; location.hash = toHash(tab, layers); };
  const pushLayer = (l: Layer) => go(route.tab, [...route.layers, l]);
  const popLayer = () => {
    if (pushes.current > 0) { pushes.current--; history.back(); }
    else history.replaceState(null, '', toHash(route.tab, route.layers.slice(0, -1))), setRoute(parseHash());
  };
  const setTab = (tab: Tab) => {
    if (tab === route.tab && !route.layers.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    history.replaceState(null, '', toHash(tab, [])); pushes.current = 0; setRoute(parseHash()); window.scrollTo(0, 0);
  };

  // ---------------------------------------------------------------- data
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [bookmarks, setBookmarks] = useState<ArticleSummary[]>([]);
  const [vocab, setVocab] = useState<VocabEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [extra, setExtra] = useState<Record<string, ArticleSummary>>({});
  const [filters, setFiltersState] = useState<Filters>(() => loadJSON('bews.filters', DEFAULT_FILTERS));
  const setFilters = (f: Filters) => { setFiltersState(f); localStorage.setItem('bews.filters', JSON.stringify(f)); };

  const loadAll = useCallback(async () => {
    const [a, s, b, v] = await Promise.allSettled([api.articles({ days: 30 }), api.sources(), api.bookmarks(), api.vocab()]);
    if (a.status === 'fulfilled') setArticles(a.value);
    if (s.status === 'fulfilled') setSources(s.value);
    if (b.status === 'fulfilled') setBookmarks(b.value);
    if (v.status === 'fulfilled') setVocab(v.value);
    setLoading(false);
  }, []);
  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 5 * 60_000); // pick up the server's 30-min background sync
    return () => clearInterval(id);
  }, [loadAll]);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const r = await api.refresh();
      await loadAll();
      setVersion((x) => x + 1);
      flash(`${i18n.t('refreshed')} · +${r.newArticles} ${i18n.t('newStories')}`);
    } catch {
      flash(i18n.t('refreshFailed'));
    } finally {
      setRefreshing(false);
    }
  };

  const toggleBookmark = async (a: ArticleSummary) => {
    const on = !(a.bookmarked ?? bookmarks.some((b) => b.id === a.id));
    const patch = (x: ArticleSummary) => (x.id === a.id ? { ...x, bookmarked: on } : x);
    setArticles((l) => l.map(patch));
    setExtra((m) => (m[a.id] ? { ...m, [a.id]: patch(m[a.id]) } : m));
    setBookmarks((l) => (on ? [{ ...a, bookmarked: true }, ...l.filter((x) => x.id !== a.id)] : l.filter((x) => x.id !== a.id)));
    try { await api.setBookmark(a.id, on, a); } catch { loadAll(); }
  };

  const refreshVocab = () => api.vocab().then(setVocab).catch(() => {});
  const deleteVocab = async (id: number) => { setVocab((l) => l.filter((v) => v.id !== id)); await api.deleteVocab(id).catch(() => refreshVocab()); };

  const srcMap = useMemo(() => sourceMap(sources), [sources]);
  const vocabWords = useMemo(() => new Set(vocab.map((v) => normWord(v.word))), [vocab]);
  const byId = useMemo(() => {
    const m = new Map<string, ArticleSummary>();
    for (const a of bookmarks) m.set(a.id, a);
    for (const a of Object.values(extra)) m.set(a.id, a);
    for (const a of articles) m.set(a.id, a);
    return m;
  }, [articles, bookmarks, extra]);

  // deep-linked articles that aren't in the loaded window
  useEffect(() => {
    for (const l of route.layers) {
      if (l.kind === 'article' && !byId.has(l.id) && !loading) {
        api.article(l.id).then((a) => setExtra((m) => ({ ...m, [a.id]: a }))).catch(() => {});
      }
    }
  }, [route.layers, byId, loading]);

  const openArticle = (a: ArticleSummary) => { setExtra((m) => (byId.has(a.id) ? m : { ...m, [a.id]: a })); pushLayer({ kind: 'article', id: a.id }); };
  const filterCount = activeFilterCount(filters);

  // lock background scroll while an overlay is open
  useEffect(() => { document.body.style.overflow = route.layers.length ? 'hidden' : ''; }, [route.layers.length]);

  return (
    <I18nContext.Provider value={i18n}>
      <div className="mx-auto min-h-screen w-full max-w-[720px] bg-cream pb-24 md:border-x md:border-line">
        {route.tab === 'wire' && (
          <WireScreen
            articles={articles}
            loading={loading}
            sources={srcMap}
            filters={filters}
            filterCount={filterCount}
            refreshing={refreshing}
            onResetFilters={() => setFilters({ ...DEFAULT_FILTERS, followed: filters.followed })}
            onOpen={openArticle}
            onBookmark={toggleBookmark}
            onSearch={() => pushLayer({ kind: 'search' })}
            onFilter={() => pushLayer({ kind: 'filter' })}
            onRefresh={refresh}
          />
        )}
        {route.tab === 'vocab' && <VocabScreen vocab={vocab} onDelete={deleteVocab} onOpenArticle={(id) => pushLayer({ kind: 'article', id })} />}
        {route.tab === 'saved' && <SavedScreen items={bookmarks} sources={srcMap} onOpen={openArticle} onBookmark={toggleBookmark} />}
        {route.tab === 'settings' && <SettingsScreen sources={sources} refreshing={refreshing} onRefresh={refresh} version={version} />}
        <Footer onTab={setTab} sourceCount={sources.length || undefined} />
      </div>

      <BottomNav tab={route.tab} onTab={setTab} vocabCount={vocab.length} />

      {route.layers.map((l, i) => {
        const key = `${i}-${l.kind}-${l.kind === 'article' ? l.id : ''}`;
        if (l.kind === 'filter') return <FilterScreen key={key} filters={filters} sources={sources} onChange={setFilters} onClose={popLayer} />;
        if (l.kind === 'search') return <SearchScreen key={key} articles={articles} sources={srcMap} onOpen={openArticle} onBookmark={toggleBookmark} onClose={popLayer} />;
        const a = byId.get(l.id);
        if (!a) return null;
        return (
          <Reader key={key} summary={a} source={srcMap.get(a.sourceId)} vocabWords={vocabWords} onClose={popLayer} onBookmark={toggleBookmark} onVocabAdded={refreshVocab} />
        );
      })}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-6">
          <div className="toast-in rounded-full bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-lg">{toast}</div>
        </div>
      )}
    </I18nContext.Provider>
  );
}
