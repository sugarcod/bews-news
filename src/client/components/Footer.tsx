import { ArrowUp, Code }  from 'lucide-react';
import { STATIC } from '../api.ts';
import { SOURCE_COUNT } from '../logic.ts';
import { useI18n } from '../i18n.ts';
import { Wordmark, type Tab } from './Chrome.tsx';
import { cx } from './ui.tsx';

interface Props {
  /** Scroll container to rewind; defaults to the window. */
  scrollEl?: () => HTMLElement | null;
  onTab?: (t: Tab) => void;
  className?: string;
  sourceCount?: number;
}

export function Footer({ scrollEl, onTab, className, sourceCount = SOURCE_COUNT }: Props) {
  const { t, lang } = useI18n();
  const toTop = () => {
    const el = scrollEl?.();
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const links: { id: Tab; label: string }[] = [
    { id: 'wire', label: t('navWire') },
    { id: 'vocab', label: t('navVocab') },
    { id: 'saved', label: t('navSaved') },
    { id: 'settings', label: t('navSettings') },
  ];
  return (
    <footer className={cx('mt-8 border-t border-line px-5 pb-6 pt-6 text-[13px] text-muted', className)}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Wordmark />
          <p className="mt-2 max-w-[30ch] leading-snug text-ink/80">{t('footerTagline')}</p>
        </div>
        <button
          type="button"
          onClick={toTop}
          aria-label={t('backToTop')}
          title={t('backToTop')}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-[12.5px] font-semibold text-ink transition hover:border-brand hover:text-brand"
        >
          <ArrowUp size={14} strokeWidth={2.5} /> {t('backToTop')}
        </button>
      </div>

      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
        <span>{t('footerSources', { n: sourceCount })}</span>
        <span aria-hidden>·</span>
        <span>{STATIC ? t('footerAutoHour') : t('footerAuto', { n: 30 })}</span>
        <span className="rounded-full border border-brand/30 bg-brand-soft px-2 py-[1px] text-[11.5px] font-bold tracking-wide text-brand" dir="ltr">EN · HE → RU</span>
      </p>

      {onTab && (
        <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] font-semibold">
          {links.map((l) => (
            <button key={l.id} type="button" onClick={() => onTab(l.id)} className="text-ink/80 hover:text-brand">{l.label}</button>
          ))}
          <a href="https://github.com/sugarcod/bews-news" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink/80 hover:text-brand">
            <Code size={13} /> {t('footerSource')}
          </a>
        </nav>
      )}

      <p className="mt-4 text-[11.5px] leading-snug text-[#a39b91]">
        {t('footerNote')} © {new Date().getFullYear()} bews news · {lang.toUpperCase()}
      </p>
    </footer>
  );
}
