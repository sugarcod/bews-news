import { BookOpen, Bookmark, Newspaper, Search, Settings, SlidersHorizontal, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n.ts';
import { CircleButton, cx } from './ui.tsx';

export type Tab = 'wire' | 'vocab' | 'saved' | 'settings';

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
      className="flex items-center rounded-full border border-brand/40 bg-brand-soft p-[2px] text-[11px] font-bold tracking-wide"
      aria-label="Switch interface language"
    >
      {(['ru', 'en'] as const).map((l) => (
        <span key={l} className={cx('rounded-full px-2 py-[3px] transition', lang === l ? 'bg-brand text-white' : 'text-brand')}>{l.toUpperCase()}</span>
      ))}
    </button>
  );
}

export function Wordmark() {
  return (
    <span className="select-none text-[25px] leading-none tracking-[-0.03em] text-ink">
      <span className="font-extrabold">bews</span>
      <span className="font-light text-[#4a443e]">news</span>
    </span>
  );
}

export function WireHeader({ filterCount, refreshing, onSearch, onFilter, onRefresh }: { filterCount: number; refreshing: boolean; onSearch: () => void; onFilter: () => void; onRefresh: () => void }) {
  const { t } = useI18n();
  return (
    <header className="flex items-center gap-2 px-5 pb-3 pt-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Wordmark />
        <LangToggle />
      </div>
      <div className="ms-auto flex items-center gap-2">
        <CircleButton onClick={onSearch} aria-label={t('search')}><Search size={18} strokeWidth={2.2} /></CircleButton>
        <CircleButton onClick={onFilter} aria-label={t('filter')} badge={filterCount}><SlidersHorizontal size={18} strokeWidth={2.2} /></CircleButton>
        <CircleButton solid onClick={onRefresh} aria-label={t('refresh')} disabled={refreshing}>
          <RefreshCw size={18} strokeWidth={2.4} className={refreshing ? 'animate-spin' : ''} />
        </CircleButton>
      </div>
    </header>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="flex items-start gap-3 px-5 pb-3 pt-5">
      <div className="min-w-0">
        <h1 className="text-[27px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[14px] text-muted">{subtitle}</p>}
      </div>
      <div className="ms-auto flex shrink-0 items-center gap-2 pt-1">{right}</div>
    </header>
  );
}

export function BottomNav({ tab, onTab, vocabCount }: { tab: Tab; onTab: (t: Tab) => void; vocabCount: number }) {
  const { t } = useI18n();
  const items: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'wire', label: t('navWire'), icon: <Newspaper size={21} strokeWidth={2} /> },
    { id: 'vocab', label: t('navVocab'), icon: <BookOpen size={21} strokeWidth={2} /> },
    { id: 'saved', label: t('navSaved'), icon: <Bookmark size={21} strokeWidth={2} /> },
    { id: 'settings', label: t('navSettings'), icon: <Settings size={21} strokeWidth={2} /> },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-center">
      <div className="flex w-full max-w-[720px] border-t border-line bg-navbg/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5 backdrop-blur md:border-x">
        {items.map((it) => {
          const active = tab === it.id;
          return (
            <button key={it.id} type="button" onClick={() => onTab(it.id)} className={cx('flex flex-1 flex-col items-center gap-0.5 py-1 text-[11.5px] font-semibold transition', active ? 'text-brand' : 'text-muted hover:text-ink')}>
              <span className={cx('relative grid h-8 w-14 place-items-center rounded-full transition', active && 'bg-brand-soft')}>
                {it.icon}
                {it.id === 'vocab' && vocabCount > 0 && !active && <span className="absolute right-2.5 top-1 h-2 w-2 rounded-full bg-brand ring-2 ring-navbg" />}
              </span>
              {it.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
