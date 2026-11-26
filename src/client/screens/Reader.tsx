import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Check, ChevronLeft, ExternalLink, Languages, Plus, X, Info, RotateCw } from 'lucide-react';
import type { ArticleFull, ArticleSummary, NewsLang, SourceInfo, TranslateResult } from '../../shared/types.ts';
import { useI18n } from '../i18n.ts';
import { api, translateMemo } from '../api.ts';
import { TOPIC_COLORS } from '../logic.ts';
import { buildParagraphs, normWord, type Sentence } from '../tokenize.ts';
import { CircleButton, LangBadge, Overlay, SourceIcon, Spinner, cx } from '../components/ui.tsx';

type TState = { status: 'loading' } | { status: 'done'; r: TranslateResult } | { status: 'error' };

interface Popover {
  text: string;
  context: string;
  tokenKey: string | null;
  kind: 'word' | 'phrase';
}

interface Props {
  summary: ArticleSummary;
  source?: SourceInfo;
  vocabWords: Set<string>;
  onClose: () => void;
  onBookmark: (a: ArticleSummary) => void;
  onVocabAdded: () => void;
}

export function Reader({ summary, source, vocabWords, onClose, onBookmark, onVocabAdded }: Props) {
  const { t, topic, rel } = useI18n();
  const [article, setArticle] = useState<ArticleFull | null>(null);
  const [error, setError] = useState(false);
  const [tr, setTr] = useState<Record<string, TState>>({});
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [pop, setPop] = useState<Popover | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const lang: NewsLang = summary.lang;
  const he = lang === 'he';
  const dir = he ? 'rtl' : 'ltr';

  const load = useCallback(() => {
    setError(false);
    api.article(summary.id, summary).then(setArticle).catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.id]);
  useEffect(load, [load]);

  const paragraphs = useMemo<Sentence[][]>(() => (article ? buildParagraphs(article.paragraphs, lang) : []), [article, lang]);
  const sentenceCount = paragraphs.reduce((n, p) => n + p.length, 0);

  const translateKey = useCallback(
    (key: string, text: string) => {
      setTr((m) => (m[key]?.status === 'done' ? m : { ...m, [key]: { status: 'loading' } }));
      translateMemo(text.trim(), lang)
        .then((r) => setTr((m) => ({ ...m, [key]: { status: 'done', r } })))
        .catch(() => setTr((m) => ({ ...m, [key]: { status: 'error' } })));
    },
    [lang],
  );

  const toggleSentence = useCallback(
    (key: string, text: string) => {
      setOpen((s) => {
        const n = new Set(s);
        if (n.has(key)) n.delete(key);
        else {
          n.add(key);
          translateKey(key, text);
        }
        return n;
      });
    },
    [translateKey],
  );

  const allOpen = sentenceCount > 0 && open.size >= sentenceCount;
  const translateAll = async () => {
    if (allOpen) { setOpen(new Set()); return; }
    const jobs: [string, string][] = [];
    paragraphs.forEach((p, pi) => p.forEach((s, si) => jobs.push([`${pi}-${si}`, s.text])));
    setOpen(new Set(jobs.map(([k]) => k)));
    // modest concurrency so the free endpoint isn't hammered
    let i = 0;
    const worker = async () => {
      while (i < jobs.length) {
        const [k, text] = jobs[i++];
        translateKey(k, text);
        await new Promise((r) => setTimeout(r, 120));
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  };

  // --- word taps (event delegation) ---
  const onBodyClick = (e: React.MouseEvent) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 1) return; // phrase selection handles itself
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-w]');
    if (!el) return;
    const sentEl = el.closest<HTMLElement>('[data-s]');
    setPop({ text: el.textContent || '', context: sentEl?.dataset.text || '', tokenKey: el.dataset.w || null, kind: 'word' });
  };

  // --- phrase selection (mouse drag on desktop, long-press handles on Android) ---
  useEffect(() => {
    let timer: number | undefined;
    const check = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !bodyRef.current) return;
      const text = sel.toString().replace(/\s+/g, ' ').trim();
      if (text.length < 2 || text.length > 600) return;
      const anchor = sel.anchorNode instanceof HTMLElement ? sel.anchorNode : sel.anchorNode?.parentElement;
      if (!anchor || !bodyRef.current.contains(anchor)) return;
      const sentEl = anchor.closest<HTMLElement>('[data-s]');
      const clean = text;
      setPop({ text: clean, context: sentEl?.dataset.text || clean, tokenKey: null, kind: /\s/.test(clean) ? 'phrase' : 'word' });
    };
    const onSel = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(check, 450);
    };
    const onUp = () => { window.clearTimeout(timer); timer = window.setTimeout(check, 30); };
    document.addEventListener('selectionchange', onSel);
    document.addEventListener('mouseup', onUp);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('selectionchange', onSel);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Keep the tapped word / selection visible above the bottom sheet.
  useEffect(() => {
    if (!pop) return;
    const scroller = document.getElementById('reader-scroll');
    const el = pop.tokenKey ? document.querySelector(`[data-w="${pop.tokenKey}"]`)?.closest('[data-s]') : window.getSelection()?.anchorNode?.parentElement;
    if (!scroller || !(el instanceof HTMLElement)) return;
    const r = el.getBoundingClientRect();
    const top = scroller.getBoundingClientRect().top + 12;
    if (r.top > window.innerHeight * 0.2 || r.top < top) scroller.scrollBy({ top: r.top - top, behavior: 'smooth' });
  }, [pop]);

  const a = article || summary;
  const bookmarked = !!a.bookmarked;
  const headlineKey = 'title';

  return (
    <Overlay onClose={pop ? () => setPop(null) : onClose}>
      <header className="flex items-center gap-3 border-b border-line/70 bg-cream/95 px-4 py-2.5 backdrop-blur">
        <CircleButton onClick={onClose} aria-label={t('back')}><ChevronLeft size={20} strokeWidth={2.4} /></CircleButton>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SourceIcon source={source} size={24} />
          <span className="truncate text-[15px] font-bold text-ink" dir="auto">{source?.name}</span>
        </div>
        <CircleButton
          onClick={() => {
            onBookmark(a);
            setArticle((x) => (x ? { ...x, bookmarked: !x.bookmarked } : x));
          }}
          aria-label={t('bookmark')}
          className={bookmarked ? '!border-brand !bg-brand-soft !text-brand' : ''}
        >
          <Bookmark size={17} fill={bookmarked ? 'currentColor' : 'none'} />
        </CircleButton>
        <a href={a.url} target="_blank" rel="noreferrer" aria-label={t('openOriginal')} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-ink hover:border-[#d8cfc3]">
          <ExternalLink size={17} />
        </a>
      </header>

      <div className="flex-1 overflow-y-auto pb-40" id="reader-scroll" style={pop ? { paddingBottom: '65vh' } : undefined}>
        <div className="px-5 pt-5">
          <div className="mb-3 flex items-center gap-2 text-[12.5px] text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: TOPIC_COLORS[a.topic] }} />
            <span className="font-semibold uppercase tracking-[0.06em]">{topic(a.topic)}</span>
            <LangBadge lang={lang} />
            <span>· {rel(a.publishedAt)}</span>
          </div>

          <h1 dir={dir} lang={lang} className={cx('text-[25px] font-extrabold leading-[1.22] tracking-[-0.015em] text-ink', he && 'font-he text-right text-[27px]')}>
            {a.title}
          </h1>
          <button
            type="button"
            onClick={() => toggleSentence(headlineKey, a.title)}
            className={cx('mt-2.5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition', open.has(headlineKey) ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-white text-muted hover:border-brand hover:text-brand')}
          >
            <Languages size={14} /> {open.has(headlineKey) ? t('hideTranslation') : t('translateHeadline')}
          </button>
          {open.has(headlineKey) && <TranslationBlock state={tr[headlineKey]} big onRetry={() => translateKey(headlineKey, a.title)} />}

          {a.image && (
            <img src={a.image} alt="" referrerPolicy="no-referrer" className="mt-5 aspect-[16/9] w-full rounded-2xl border border-line object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
          )}

          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13px] leading-snug text-muted">
            <Info size={16} className="mt-0.5 shrink-0 text-brand" />
            <span>{t('readerHint')}</span>
          </div>

          {article && sentenceCount > 1 && (
            <div className="mt-4 flex items-center justify-between gap-2">
              <span className="text-[12px] text-muted">
                {article.extraction === 'summary' ? t('extractedSummary') : article.extraction === 'rss-content' ? t('extractedRss') : t('extractedReadability')}
              </span>
              <button type="button" onClick={translateAll} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-black">
                <Languages size={14} /> {allOpen ? t('hideAll') : t('translateAll')}
              </button>
            </div>
          )}
        </div>

        <div ref={bodyRef} onClick={onBodyClick} className="px-5 pt-3">
          {!article && !error && (
            <div className="space-y-3 pt-4">
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-4 animate-pulse rounded bg-stone-track" style={{ width: `${95 - i * 9}%` }} />)}
            </div>
          )}
          {error && (
            <div className="py-10 text-center">
              <p className="text-muted">{t('articleLoadFailed')}</p>
              <button type="button" onClick={load} className="mt-3 inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[14px] font-semibold"><RotateCw size={14} /> {t('retry')}</button>
            </div>
          )}
          {article && article.extraction === 'summary' && sentenceCount <= 1 && (
            <p className="mb-3 text-[12.5px] text-muted">{t('extractedSummary')}</p>
          )}
          {paragraphs.map((p, pi) => (
            <p key={pi} dir={dir} lang={lang} className={cx('reader-p mb-5 text-[18px] leading-[1.7] text-ink', he && 'font-he text-right text-[19px]')}>
              {p.map((s, si) => {
                const key = `${pi}-${si}`;
                return (
                  <SentenceView
                    key={key}
                    k={key}
                    s={s}
                    isOpen={open.has(key)}
                    state={tr[key]}
                    activeToken={pop?.tokenKey ?? null}
                    vocabWords={vocabWords}
                    onToggle={toggleSentence}
                    onRetry={translateKey}
                    label={t('translateSentence')}
                  />
                );
              })}
            </p>
          ))}
        </div>
      </div>

      {pop && (
        <WordSheet
          pop={pop}
          lang={lang}
          article={a}
          saved={vocabWords.has(normWord(pop.text))}
          onClose={() => {
            setPop(null);
            window.getSelection()?.removeAllRanges();
          }}
          onAdded={onVocabAdded}
        />
      )}
    </Overlay>
  );
}

const SentenceView = memo(function SentenceView({
  k, s, isOpen, state, activeToken, vocabWords, onToggle, onRetry, label,
}: {
  k: string; s: Sentence; isOpen: boolean; state?: TState; activeToken: string | null; vocabWords: Set<string>;
  onToggle: (k: string, text: string) => void; onRetry: (k: string, text: string) => void; label: string;
}) {
  return (
    <>
      <span data-s={k} data-text={s.text.trim()} className={cx('sentence rounded-[3px] transition-colors', isOpen && 'bg-[#F6E9DF]')}>
        {s.tokens.map((tok, ti) =>
          tok.word ? (
            <span
              key={ti}
              data-w={`${k}-${ti}`}
              className={cx('tok', activeToken === `${k}-${ti}` && 'tok-active', vocabWords.has(normWord(tok.text)) && 'tok-known')}
            >
              {tok.text}
            </span>
          ) : (
            <span key={ti}>{tok.text}</span>
          ),
        )}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(k, s.text); }}
        aria-label={label}
        title={label}
        className={cx('sent-btn mx-1 inline-flex translate-y-[-2px] select-none items-center rounded-full border px-1.5 py-[1px] align-middle text-[10px] font-bold leading-[14px] tracking-wide transition', isOpen ? 'border-brand bg-brand text-white' : 'border-line bg-white text-muted hover:border-brand hover:text-brand')}
        dir="ltr"
      />
      {isOpen && <TranslationBlock state={state} onRetry={() => onRetry(k, s.text)} />}
    </>
  );
});

function TranslationBlock({ state, big, onRetry }: { state?: TState; big?: boolean; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <span dir="ltr" lang="ru" className={cx('tr-block my-2 block rounded-xl border-l-[3px] border-brand bg-tint px-3.5 py-2.5 text-left font-sans text-ink', big ? 'text-[16.5px] leading-snug' : 'text-[15.5px] leading-[1.5]')}>
      {!state || state.status === 'loading' ? (
        <span className="flex items-center gap-2 text-muted"><Spinner className="h-3.5 w-3.5" /> {t('translating')}</span>
      ) : state.status === 'error' ? (
        <span className="flex items-center gap-2 text-brand">{t('translationFailed')} <button type="button" onClick={onRetry} className="underline">{t('retry')}</button></span>
      ) : (
        <>
          {state.r.translation}
          <span className="ms-2 select-none whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-wide text-[#a39b91]">
            {state.r.cached ? `· ${t('fromCache')}` : `· ${state.r.provider}`}
          </span>
        </>
      )}
    </span>
  );
}

function WordSheet({ pop, lang, article, saved, onClose, onAdded }: { pop: Popover; lang: NewsLang; article: ArticleSummary; saved: boolean; onClose: () => void; onAdded: () => void }) {
  const { t } = useI18n();
  const [state, setState] = useState<TState>({ status: 'loading' });
  const [added, setAdded] = useState(saved);
  const [adding, setAdding] = useState(false);
  const he = lang === 'he';
  const display = pop.kind === 'word' ? pop.text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') : pop.text;

  useEffect(() => {
    setState({ status: 'loading' });
    setAdded(saved);
    let alive = true;
    translateMemo(display, lang)
      .then((r) => alive && setState({ status: 'done', r }))
      .catch(() => alive && setState({ status: 'error' }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display, lang]);

  const add = async () => {
    if (state.status !== 'done' || added) return;
    setAdding(true);
    try {
      await api.addVocab({ word: display, translation: state.r.translation, lang, context: pop.context, articleTitle: article.title, articleUrl: article.url, articleId: article.id });
      setAdded(true);
      onAdded();
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center" role="dialog">
      <div className="sheet-up w-full max-w-[720px] rounded-t-[26px] border border-b-0 border-line bg-white px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-2.5 shadow-[0_-12px_40px_-12px_rgba(26,24,22,0.28)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-deep" />
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <LangBadge lang={lang} />
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{lang === 'he' ? 'HE → RU' : 'EN → RU'}</span>
            </div>
            <p dir={he ? 'rtl' : 'ltr'} lang={lang} className={cx('break-words font-extrabold text-ink', pop.kind === 'word' ? 'text-[26px] leading-tight' : 'line-clamp-3 text-[18px] leading-snug', he && 'font-he text-right')}>
              {display}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-track text-muted hover:text-ink" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="mt-2.5 min-h-[44px] rounded-2xl bg-tint px-4 py-2.5">
          {state.status === 'loading' && <span className="flex items-center gap-2 text-muted"><Spinner className="h-4 w-4" /> {t('translating')}</span>}
          {state.status === 'error' && <span className="text-brand">{t('translationFailed')}</span>}
          {state.status === 'done' && (
            <>
              <p lang="ru" className={cx('font-bold text-brand-dark', pop.kind === 'word' ? 'text-[22px] leading-tight' : 'text-[17px] leading-snug')}>{state.r.translation}</p>
              {state.r.alternatives && state.r.alternatives.length > 0 && (
                <div className="mt-2 space-y-0.5 text-[13.5px] leading-snug text-ink/80">
                  {state.r.alternatives.slice(0, 2).map((g) => (
                    <p key={g.pos} className="line-clamp-1"><span className="me-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{g.pos}</span>{g.terms.slice(0, 5).join(', ')}</p>
                  ))}
                </div>
              )}
              <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#a39b91]">{state.r.cached ? t('fromCache') : `${t('via')} ${state.r.provider}`}</p>
            </>
          )}
        </div>

        {pop.context && pop.context !== display && (
          <div className="mt-3">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{t('inContext')}</p>
            <p dir={he ? 'rtl' : 'ltr'} className={cx('line-clamp-2 text-[14px] leading-snug text-muted', he && 'font-he text-right')}>
              <Highlight text={pop.context} term={display} />
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={add}
          disabled={state.status !== 'done' || adding || added}
          className={cx('mt-3.5 flex w-full items-center justify-center gap-2 rounded-full py-3 text-[15.5px] font-bold transition', added ? 'border border-brand bg-brand-soft text-brand' : 'bg-brand text-white shadow-[0_6px_16px_-6px_rgba(162,53,38,0.65)] hover:bg-brand-dark disabled:opacity-60')}
        >
          {added ? <Check size={18} strokeWidth={3} /> : adding ? <Spinner /> : <Plus size={18} strokeWidth={3} />}
          {added ? t('addedToVocab') : t('addToVocab')}
        </button>
      </div>
    </div>
  );
}

function Highlight({ text, term }: { text: string; term: string }) {
  const i = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-brand-soft px-0.5 font-semibold text-brand">{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  );
}
