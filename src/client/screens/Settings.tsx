import { useEffect, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import type { SourceInfo, Stats } from '../../shared/types.ts';
import { useI18n } from '../i18n.ts';
import { api } from '../api.ts';
import { PageHeader } from '../components/Chrome.tsx';
import { LangBadge, Segmented, SourceIcon, Spinner, cx } from '../components/ui.tsx';

interface Props { sources: SourceInfo[]; refreshing: boolean; onRefresh: () => Promise<void> | void; version: number }

export function SettingsScreen({ sources, refreshing, onRefresh, version }: Props) {
  const { t, lang, setLang, rel } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => { api.stats().then(setStats).catch(() => {}); }, [version, refreshing]);

  const fmt = (n?: number) => (n ?? 0).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US');
  const nextIn = stats?.nextRefreshAt ? Math.max(0, Math.round((stats.nextRefreshAt - Date.now()) / 60_000)) : null;

  return (
    <div className="pb-6">
      <PageHeader title={t('settingsTitle')} subtitle={t('about')} />
      <div className="space-y-4 px-5">
        <Card title={t('interfaceLanguage')}>
          <Segmented value={lang} onChange={setLang} options={[{ value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }]} />
        </Card>

        <Card title={t('autoRefresh')}>
          <Row label={t('autoRefresh')} value={<span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#2F9E5B]" />{t('every')} {stats?.refreshIntervalMin ?? 30} {t('minutes')}</span>} />
          <Row label={t('lastRefresh')} value={stats?.lastRefreshAt ? `${rel(stats.lastRefreshAt)} · ${new Date(stats.lastRefreshAt).toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}` : t('never')} />
          {nextIn !== null && <Row label={t('nextRefresh')} value={t('inMin', { n: nextIn })} />}
          <button type="button" onClick={() => onRefresh()} disabled={refreshing} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3 text-[15px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(162,53,38,0.65)] hover:bg-brand-dark disabled:opacity-70">
            {refreshing ? <Spinner /> : <RefreshCw size={17} strokeWidth={2.5} />} {refreshing ? t('refreshing') : t('refreshNow')}
          </button>
        </Card>

        <Card title={t('cache')}>
          <Row label={t('articlesLabel')} value={stats ? `${fmt(stats.articles)} (EN ${fmt(stats.articlesEn)} · HE ${fmt(stats.articlesHe)})` : '—'} />
          <Row label={t('fullTextCached')} value={fmt(stats?.extracted)} />
          <Row label={t('cachedTranslations')} value={stats ? `${fmt(stats.translations)} (${fmt(stats.translationsWords)} ${t('wordsLabel')} · ${fmt(stats.translationsSentences)} ${t('sentencesLabel')})` : '—'} />
          <Row label={t('vocabCount')} value={fmt(stats?.vocab)} />
          <Row label={t('bookmarksCount')} value={fmt(stats?.bookmarks)} />
        </Card>

        <Card title={t('provider')}>
          <Row label={t('providerActive')} value={<span className="inline-flex items-center gap-1.5 font-semibold text-ink"><Check size={14} className="text-[#2F9E5B]" strokeWidth={3} />{stats?.provider.active ?? '—'}</span>} />
          <Row label={t('providerFallbacks')} value={stats?.provider.fallbacks.join(' → ') || '—'} />
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{t('providerHint')}</p>
        </Card>

        <Card title={t('feedsStatus')}>
          <div className="-mx-1">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 border-b border-line px-1 py-2 last:border-b-0">
                <SourceIcon source={s} size={22} />
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold" dir="auto">{s.name}</span>
                <LangBadge lang={s.lang} />
                <span className={cx('w-24 shrink-0 text-end text-[12px]', s.lastError ? 'text-brand' : 'text-muted')}>
                  {s.lastError ? t('failed') : `${s.articleCount ?? 0} · ${s.lastFetchedAt ? rel(s.lastFetchedAt) : '—'}`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">{title}</h2>
      {children}
    </section>
  );
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-[14px]">
      <span className="text-muted">{label}</span>
      <span className="text-end text-ink">{value}</span>
    </div>
  );
}
