import { useMemo, useState } from 'react';
import { BookOpen, Download, ExternalLink, Search, Trash2 } from 'lucide-react';
import type { VocabEntry } from '../../shared/types.ts';
import { useI18n } from '../i18n.ts';
import { api } from '../api.ts';
import { SpeakButton } from '../components/SpeakButton.tsx';
import { PageHeader } from '../components/Chrome.tsx';
import { EmptyState, LangBadge, Segmented, cx } from '../components/ui.tsx';

interface Props {
  vocab: VocabEntry[];
  onDelete: (id: number) => void;
  onOpenArticle: (id: string) => void;
}

export function VocabScreen({ vocab, onDelete, onOpenArticle }: Props) {
  const { t, rel, pl } = useI18n();
  const [lang, setLang] = useState<'all' | 'en' | 'he'>('all');
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return vocab.filter((v) => (lang === 'all' || v.lang === lang) && (!term || `${v.word} ${v.translation} ${v.context}`.toLowerCase().includes(term)));
  }, [vocab, lang, q]);
  const counts = { all: vocab.length, en: vocab.filter((v) => v.lang === 'en').length, he: vocab.filter((v) => v.lang === 'he').length };

  return (
    <div>
      <div className="sticky top-0 z-20 bg-cream/95 backdrop-blur">
        <PageHeader
          title={t('vocabTitle')}
          subtitle={`${pl(vocab.length, 'words')} · ${t('vocabSubtitle')}`}
          right={
            <button
              type="button"
              onClick={() => api.exportCsv(lang === 'all' ? undefined : lang)}
              disabled={!vocab.length}
              title={t('exportHint')}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-[13.5px] font-bold text-white shadow-[0_4px_12px_-4px_rgba(162,53,38,0.6)] hover:bg-brand-dark disabled:opacity-50"
            >
              <Download size={15} strokeWidth={2.5} /> {t('exportCsv')}
            </button>
          }
        />
        <div className="space-y-3 px-5 pb-3">
          <Segmented
            value={lang}
            onChange={setLang}
            options={[
              { value: 'all', label: `${t('all')} · ${counts.all}` },
              { value: 'en', label: `EN · ${counts.en}` },
              { value: 'he', label: `HE · ${counts.he}` },
            ]}
          />
          <label className="flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 focus-within:border-brand">
            <Search size={17} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchVocab')} dir="auto" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#a39b91]" />
          </label>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<BookOpen size={24} />} title={t('emptyVocab')} hint={t('emptyVocabHint')} />
      ) : (
        <div className="space-y-3 px-5 pb-6 pt-1">
          {list.map((v) => {
            const he = v.lang === 'he';
            return (
              <div key={v.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <LangBadge lang={v.lang} />
                      <span className="text-[11.5px] text-muted">{rel(v.createdAt)}</span>
                    </div>
                    <p dir={he ? 'rtl' : 'ltr'} lang={v.lang} className={cx('mt-1.5 break-words text-[21px] font-extrabold leading-tight text-ink', he && 'font-he text-right')}>{v.word}</p>
                    <p lang="ru" className="mt-1 text-[16.5px] font-semibold leading-snug text-brand-dark">{v.translation}</p>
                  </div>
                  <SpeakButton text={v.word} lang={v.lang} size="sm" labelKey="listenWord" />
                  <button type="button" onClick={() => onDelete(v.id)} aria-label={t('delete')} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#a39b91] transition hover:bg-brand-soft hover:text-brand">
                    <Trash2 size={17} />
                  </button>
                </div>
                {v.context && (
                  <p dir={he ? 'rtl' : 'ltr'} className={cx('mt-3 border-s-2 border-line ps-3 text-[13.5px] leading-snug text-muted', he && 'font-he')}>{v.context}</p>
                )}
                {(v.articleTitle || v.articleUrl) && (
                  <div className="mt-3 flex items-center gap-2 text-[12.5px]">
                    <span className="shrink-0 text-muted">{t('fromArticle')}:</span>
                    {v.articleId ? (
                      <button type="button" onClick={() => onOpenArticle(v.articleId!)} dir="auto" className="min-w-0 truncate font-semibold text-ink hover:text-brand">{v.articleTitle || v.articleUrl}</button>
                    ) : (
                      <span className="min-w-0 truncate font-semibold text-ink" dir="auto">{v.articleTitle}</span>
                    )}
                    {v.articleUrl && (
                      <a href={v.articleUrl} target="_blank" rel="noreferrer" className="ms-auto shrink-0 text-muted hover:text-brand" aria-label="Open source"><ExternalLink size={14} /></a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
