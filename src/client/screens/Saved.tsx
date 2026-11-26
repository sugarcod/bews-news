import { Bookmark } from 'lucide-react';
import type { ArticleSummary, SourceInfo } from '../../shared/types.ts';
import { useI18n } from '../i18n.ts';
import { PageHeader } from '../components/Chrome.tsx';
import { StoryRow } from '../components/Story.tsx';
import { EmptyState } from '../components/ui.tsx';

export function SavedScreen({ items, sources, onOpen, onBookmark }: { items: ArticleSummary[]; sources: Map<string, SourceInfo>; onOpen: (a: ArticleSummary) => void; onBookmark: (a: ArticleSummary) => void }) {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t('savedTitle')} subtitle={`${items.length} · ${t('savedSubtitle')}`} />
      {items.length === 0 ? (
        <EmptyState icon={<Bookmark size={24} />} title={t('emptySaved')} hint={t('emptySavedHint')} />
      ) : (
        <div className="mx-5 overflow-hidden rounded-2xl border border-line bg-white">
          {items.map((a) => <StoryRow key={a.id} a={a} source={sources.get(a.sourceId)} onOpen={onOpen} onBookmark={onBookmark} />)}
        </div>
      )}
    </div>
  );
}
