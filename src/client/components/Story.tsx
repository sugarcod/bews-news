import { Bookmark } from 'lucide-react';
import type { ArticleSummary, SourceInfo } from '../../shared/types.ts';
import { useI18n } from '../i18n.ts';
import { TOPIC_COLORS } from '../logic.ts';
import { LangBadge, SourceIcon, cx } from './ui.tsx';

interface RowProps {
  a: ArticleSummary;
  source?: SourceInfo;
  onOpen: (a: ArticleSummary) => void;
  onBookmark: (a: ArticleSummary) => void;
}

export function StoryRow({ a, source, onOpen, onBookmark }: RowProps) {
  const { topic, rel, t } = useI18n();
  const he = a.lang === 'he';
  return (
    <article className="story-row group border-b border-line px-5 py-4 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <SourceIcon source={source} size={20} />
          <span className="truncate text-[13px] font-semibold text-ink" dir="auto">{source?.name}</span>
        </div>
        <span className="shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">{topic(a.topic)}</span>
      </div>
      <button type="button" onClick={() => onOpen(a)} className="block w-full text-start">
        <h3
          dir={he ? 'rtl' : 'ltr'}
          lang={a.lang}
          className={cx('line-clamp-2 text-[17px] font-bold leading-[1.32] text-ink group-hover:text-brand-dark', he && 'font-he text-right text-[18px]')}
        >
          {a.title}
        </h3>
      </button>
      <div className="mt-2.5 flex items-center gap-2 text-[12.5px] text-muted">
        <LangBadge lang={a.lang} />
        <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: TOPIC_COLORS[a.topic] }} />
        <span className="min-w-0 truncate" dir="auto">{source?.name} · {topic(a.topic)}</span>
        <span className="shrink-0">· {rel(a.publishedAt)}</span>
        <button
          type="button"
          onClick={() => onBookmark(a)}
          aria-label={t('bookmark')}
          className={cx('ms-auto grid h-8 w-8 shrink-0 place-items-center rounded-full transition hover:bg-stone-track', a.bookmarked ? 'text-brand' : 'text-[#a39b91]')}
        >
          <Bookmark size={17} strokeWidth={2} fill={a.bookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>
    </article>
  );
}

export function FeaturedCard({ a, related, sources, onOpen }: { a: ArticleSummary; related: ArticleSummary[]; sources: Map<string, SourceInfo>; onOpen: (a: ArticleSummary) => void }) {
  const { t, topic, rel, pl } = useI18n();
  const he = a.lang === 'he';
  const src = sources.get(a.sourceId);
  const relSources = [...new Map(related.map((r) => [r.sourceId, sources.get(r.sourceId)])).values()].filter(Boolean) as SourceInfo[];
  return (
    <button type="button" onClick={() => onOpen(a)} className="block w-full rounded-2xl border border-line bg-white p-4 text-start shadow-[0_1px_2px_rgba(26,24,22,0.04)] transition hover:border-[#d8cfc3] active:scale-[0.995]">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-[0.08em] text-brand">
          <span className="pulse-dot relative h-2 w-2 rounded-full bg-[#D4321F]" />
          {t('developing')}
        </span>
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">{topic(a.topic)}</span>
      </div>
      <h2 dir={he ? 'rtl' : 'ltr'} lang={a.lang} className={cx('text-[21px] font-extrabold leading-[1.25] tracking-[-0.01em] text-ink', he && 'font-he text-right text-[22px]')}>
        {a.title}
      </h2>
      {a.summary && (
        <p dir={he ? 'rtl' : 'ltr'} className={cx('mt-2 line-clamp-2 text-[14.5px] leading-snug text-muted', he && 'font-he text-right')}>
          {a.summary}
        </p>
      )}
      <div className="mt-3.5 flex items-center gap-2 border-t border-line pt-3 text-[12.5px] text-muted">
        <div className="flex -space-x-1.5">
          {[src, ...relSources.slice(0, 3)].filter(Boolean).map((s, i) => (
            <span key={i} className="rounded-[7px] ring-2 ring-white"><SourceIcon source={s} size={20} /></span>
          ))}
        </div>
        {relSources.length > 0 && <span className="font-bold text-ink">+{related.length}</span>}
        <span className="truncate" dir="auto">{src?.name}{relSources.length > 0 ? ` · ${pl(relSources.length + 1, 'sources')}` : ''}</span>
        <span className="ms-auto shrink-0">{rel(a.publishedAt)}</span>
      </div>
    </button>
  );
}
