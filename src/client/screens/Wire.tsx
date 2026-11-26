import { useMemo, useState } from 'react';
import { Newspaper, Star } from 'lucide-react';
import type { ArticleSummary, SourceInfo } from '../../shared/types.ts';
import { useI18n } from '../i18n.ts';
import { applyFilters, rankTop, shownTopics, type Filters } from '../logic.ts';
import { WireHeader } from '../components/Chrome.tsx';
import { FeaturedCard, StoryRow } from '../components/Story.tsx';
import { EmptyState, Segmented, Spinner } from '../components/ui.tsx';

type WireTab = 'top' | 'latest' | 'following';

interface Props {
  articles: ArticleSummary[];
  loading: boolean;
  sources: Map<string, SourceInfo>;
  filters: Filters;
  filterCount: number;
  refreshing: boolean;
  onResetFilters: () => void;
  onOpen: (a: ArticleSummary) => void;
  onBookmark: (a: ArticleSummary) => void;
  onSearch: () => void;
  onFilter: () => void;
  onRefresh: () => void;
}

const PAGE = 40;

export function WireScreen(p: Props) {
  const { t, topic } = useI18n();
  const [tab, setTab] = useState<WireTab>(() => (sessionStorage.getItem('bews.wireTab') as WireTab) || 'top');
  const [limit, setLimit] = useState(PAGE);
  const changeTab = (v: WireTab) => { setTab(v); setLimit(PAGE); sessionStorage.setItem('bews.wireTab', v); };

  const filtered = useMemo(() => applyFilters(p.articles, p.filters), [p.articles, p.filters]);
  const view = useMemo(() => {
    if (tab === 'top') return rankTop(filtered);
    if (tab === 'latest') return { featured: null, list: filtered };
    const followed = new Set(p.filters.followed);
    return { featured: null, list: filtered.filter((a) => followed.has(a.sourceId)) };
  }, [tab, filtered, p.filters.followed]);

  const topicsShown = shownTopics(p.filters).map(topic).sort((a, b) => a.localeCompare(b));
  const sectionTitle = tab === 'top' ? t('topStories') : tab === 'latest' ? t('latestStories') : t('followingStories');

  return (
    <div>
      <div className="sticky top-0 z-20 bg-cream/95 backdrop-blur">
        <WireHeader filterCount={p.filterCount} refreshing={p.refreshing} onSearch={p.onSearch} onFilter={p.onFilter} onRefresh={p.onRefresh} />
        <div className="px-5 pb-3">
          <Segmented<WireTab>
            value={tab}
            onChange={changeTab}
            options={[
              { value: 'top', label: t('tabTop') },
              { value: 'latest', label: t('tabLatest') },
              { value: 'following', label: t('tabFollowing') },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 px-5 pb-3 pt-1 text-[13px]">
        <p className="line-clamp-2 min-w-0 flex-1 leading-snug text-muted">
          <span className="font-semibold text-ink">{t('showing')}:</span> {topicsShown.join(', ')}
        </p>
        <button type="button" onClick={p.onResetFilters} className="shrink-0 self-start font-semibold text-brand hover:underline">
          {t('showAll')}
        </button>
      </div>

      {p.loading && p.articles.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted"><Spinner /> {t('loading')}</div>
      ) : view.list.length === 0 && !view.featured ? (
        tab === 'following' && p.filters.followed.length === 0 ? (
          <EmptyState icon={<Star size={24} />} title={t('emptyFollowing')} hint={t('emptyFollowingHint')} />
        ) : (
          <EmptyState icon={<Newspaper size={24} />} title={t('emptyWire')} hint={t('emptyWireHint')} />
        )
      ) : (
        <>
          {view.featured && (
            <div className="px-5 pb-2">
              <FeaturedCard a={view.featured.article} related={view.featured.related} sources={p.sources} onOpen={p.onOpen} />
            </div>
          )}
          <div className="flex items-center gap-3 px-5 pb-1 pt-5">
            <h2 className="shrink-0 text-[12px] font-bold uppercase tracking-[0.1em] text-muted">{sectionTitle}</h2>
            <span className="h-px flex-1 bg-line" />
            <span className="shrink-0 text-[12px] text-muted">{view.list.length + (view.featured ? 1 : 0)}</span>
          </div>
          <div>
            {view.list.slice(0, limit).map((a) => (
              <StoryRow key={a.id} a={a} source={p.sources.get(a.sourceId)} onOpen={p.onOpen} onBookmark={p.onBookmark} />
            ))}
          </div>
          {view.list.length > limit && (
            <div className="px-5 py-5">
              <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="w-full rounded-full border border-line bg-white py-3 text-[14px] font-semibold text-ink hover:border-brand hover:text-brand">
                + {Math.min(PAGE, view.list.length - limit)}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
