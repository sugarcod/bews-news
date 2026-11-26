import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search as SearchIcon, X, Check } from 'lucide-react';
import type { ArticleSummary, SourceInfo } from '../../shared/types.ts';
import { useI18n } from '../i18n.ts';
import { api } from '../api.ts';
import { StoryRow } from '../components/Story.tsx';
import { Overlay, Spinner, cx } from '../components/ui.tsx';

const SUGGESTIONS = ['Bank of Israel', 'Tech', 'Economy', 'Jerusalem', 'AI', 'Haaretz', 'בנק ישראל', 'נתניהו'];

interface Props {
  articles: ArticleSummary[];
  sources: Map<string, SourceInfo>;
  onOpen: (a: ArticleSummary) => void;
  onBookmark: (a: ArticleSummary) => void;
  onClose: () => void;
}

function matches(a: ArticleSummary, q: string, src?: SourceInfo): boolean {
  const hay = `${a.title} ${a.summary} ${a.topic} ${src?.name || ''} ${src?.site || ''}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

export function SearchScreen({ articles, sources, onOpen, onBookmark, onClose }: Props) {
  const { t, topic, pl } = useI18n();
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const [remote, setRemote] = useState<ArticleSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const week = Date.now() - 7 * 86400_000;
  const local = useMemo(() => {
    const term = q.trim();
    if (!term) return [];
    // match topic names in the UI language too ("Экономика" → Economy)
    const phrase = term.toLowerCase();
    const hits = articles.filter((a) => a.publishedAt >= week && (matches(a, term, sources.get(a.sourceId)) || topic(a.topic).toLowerCase() === phrase));
    // exact phrase in the headline first, then phrase anywhere, then all-words matches
    const rank = (a: ArticleSummary) => (a.title.toLowerCase().includes(phrase) ? 0 : `${a.summary}`.toLowerCase().includes(phrase) ? 1 : 2);
    return hits.map((a, i) => ({ a, r: rank(a), i })).sort((x, y) => x.r - y.r || x.i - y.i).map((x) => x.a);
  }, [q, articles, sources, week, topic]);

  useEffect(() => {
    if (!all || !q.trim()) { setRemote(null); return; }
    setBusy(true);
    const id = setTimeout(() => {
      api.articles({ all: true, q: q.trim() }).then(setRemote).catch(() => setRemote([])).finally(() => setBusy(false));
    }, 250);
    return () => clearTimeout(id);
  }, [q, all]);

  const results = all && remote ? remote.map((r) => articles.find((a) => a.id === r.id) || r) : local;

  return (
    <Overlay onClose={onClose}>
      <header className="flex items-center gap-3 px-4 pb-2 pt-3">
        <label className="flex flex-1 items-center gap-2 rounded-full border-[1.5px] border-brand bg-white px-4 py-2.5 shadow-[0_0_0_3px_rgba(162,53,38,0.08)]">
          <SearchIcon size={18} className="shrink-0 text-brand" strokeWidth={2.3} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchPlaceholder')}
            dir="auto"
            className="min-w-0 flex-1 bg-transparent text-[15.5px] text-ink outline-none placeholder:text-[#a39b91]"
            enterKeyHint="search"
          />
          {q && <button type="button" onClick={() => setQ('')} className="text-muted" aria-label="Clear"><X size={16} /></button>}
        </label>
        <button type="button" onClick={onClose} className="shrink-0 px-1 text-[15px] font-semibold text-brand">{t('cancel')}</button>
      </header>

      <div className="flex-1 overflow-y-auto pb-10">
        <div className="mx-4 mt-2 flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
          <p className="flex-1 text-[14px] font-semibold text-ink">{all ? t('searchingAll') : t('searchingLast7')}</p>
          <button type="button" onClick={() => setAll((v) => !v)} className={cx('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition', all ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink hover:border-brand')}>
            {all ? <Check size={14} className="text-brand" strokeWidth={3} /> : <Plus size={14} className="text-brand" strokeWidth={3} />}
            {all ? t('last7') : t('searchAll')}
          </button>
        </div>

        {!q.trim() ? (
          <div className="px-5 pt-6">
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.1em] text-muted">{t('tryLabel')}</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => setQ(s)} dir="auto" className="rounded-full border border-line bg-white px-4 py-2 text-[14px] font-medium text-ink transition hover:border-brand hover:text-brand">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-5 pb-1 pt-5">
              <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted">{busy ? <Spinner className="h-3 w-3" /> : pl(results.length, 'results')}</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            {results.length === 0 && !busy ? (
              <p className="px-5 py-10 text-center text-[15px] text-muted">{t('noResults')} “{q}”</p>
            ) : (
              results.slice(0, 80).map((a) => <StoryRow key={a.id} a={a} source={sources.get(a.sourceId)} onOpen={onOpen} onBookmark={onBookmark} />)
            )}
          </>
        )}
      </div>
    </Overlay>
  );
}
