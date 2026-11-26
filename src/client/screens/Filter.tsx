import { useState } from 'react';
import { ChevronLeft, Star } from 'lucide-react';
import type { SourceInfo, Topic } from '../../shared/types.ts';
import { TOPICS } from '../../shared/types.ts';
import { useI18n } from '../i18n.ts';
import { DEFAULT_FILTERS, TOPIC_COLORS, type Filters, type TimeRange } from '../logic.ts';
import { CircleButton, LangBadge, Overlay, Pill, Segmented, SourceIcon, cx } from '../components/ui.tsx';

interface Props {
  filters: Filters;
  sources: SourceInfo[];
  onChange: (f: Filters) => void;
  onClose: () => void;
}

export function FilterScreen({ filters: f, sources, onChange, onClose }: Props) {
  const { t, topic, rel } = useI18n();
  const [pane, setPane] = useState<'topics' | 'newsrooms'>('topics');
  const set = (patch: Partial<Filters>) => onChange({ ...f, ...patch });
  const toggleTopic = (tp: Topic) => set({ topics: f.topics.includes(tp) ? f.topics.filter((x) => x !== tp) : [...f.topics, tp] });
  const toggleSource = (id: string) => set({ disabled: f.disabled.includes(id) ? f.disabled.filter((x) => x !== id) : [...f.disabled, id] });
  const toggleFollow = (id: string) => set({ followed: f.followed.includes(id) ? f.followed.filter((x) => x !== id) : [...f.followed, id] });

  const enabledCount = sources.filter((s) => !f.disabled.includes(s.id)).length;
  const isDefault = f.lang === 'all' && f.time === 'all' && f.topics.length === 0 && f.disabled.length === 0;
  const summary = isDefault
    ? t('everything')
    : [
        f.topics.length ? `${t('storiesIn').replace(/^./, (c) => c.toUpperCase())} ${TOPICS.filter((x) => f.topics.includes(x)).map(topic).join(', ')}` : t('allTopics'),
        f.lang === 'all' ? t('langAll') : f.lang === 'en' ? t('langEn') : t('langHe'),
        { all: t('timeAll'), today: t('timeToday'), '2d': t('time2d'), week: t('timeWeek') }[f.time],
        f.disabled.length ? t('fromN', { n: enabledCount }) : t('fromAll'),
      ].join(', ');

  const langs: { v: Filters['lang']; label: string }[] = [
    { v: 'all', label: t('all') },
    { v: 'en', label: t('english') },
    { v: 'he', label: t('hebrew') },
  ];
  const times: { v: TimeRange; label: string }[] = [
    { v: 'all', label: t('allTime') },
    { v: 'today', label: t('today') },
    { v: '2d', label: t('twoDays') },
    { v: 'week', label: t('thisWeek') },
  ];

  return (
    <Overlay onClose={onClose}>
      <header className="flex items-center gap-3 border-b border-line/60 px-4 py-3">
        <CircleButton onClick={onClose} aria-label={t('back')}><ChevronLeft size={20} strokeWidth={2.4} className="rtl:rotate-180" /></CircleButton>
        <h1 className="flex-1 text-[20px] font-extrabold tracking-[-0.01em] text-ink">{t('filterTitle')}</h1>
        <button type="button" onClick={onClose} className="rounded-full bg-brand px-5 py-2 text-[14.5px] font-bold text-white shadow-[0_4px_12px_-4px_rgba(162,53,38,0.6)] hover:bg-brand-dark">
          {t('done')}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-10 pt-4">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">{t('wireWillShow')}</p>
          <p className="mt-1.5 text-[15.5px] font-semibold leading-snug text-ink">{summary}</p>
          <button type="button" onClick={() => onChange({ ...DEFAULT_FILTERS, followed: f.followed })} disabled={isDefault} className="mt-3 rounded-full border border-line px-4 py-1.5 text-[13.5px] font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-40">
            {t('resetAll')}
          </button>
        </div>

        <div className="mt-5">
          <Segmented size="lg" value={pane} onChange={setPane} options={[{ value: 'topics', label: t('topicsTime') }, { value: 'newsrooms', label: t('newsrooms') }]} />
        </div>

        {pane === 'topics' ? (
          <>
            <Section title={t('language')}>
              {langs.map((l) => (
                <Pill key={l.v} active={f.lang === l.v} onClick={() => set({ lang: l.v })} className={l.v === 'he' ? 'font-he' : ''}>{l.label}</Pill>
              ))}
            </Section>
            <Section title={t('time')}>
              {times.map((x) => (
                <Pill key={x.v} active={f.time === x.v} onClick={() => set({ time: x.v })}>{x.label}</Pill>
              ))}
            </Section>
            <Section title={t('topics')} help={t('topicsHelp')}>
              {TOPICS.map((tp) => (
                <Pill key={tp} active={f.topics.includes(tp)} onClick={() => toggleTopic(tp)}>
                  <span className="me-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: TOPIC_COLORS[tp] }} />
                  {topic(tp)}
                </Pill>
              ))}
            </Section>
          </>
        ) : (
          <div className="mt-5">
            <p className="mb-3 text-[13.5px] leading-relaxed text-muted">{t('newsroomsHelp')}</p>
            <div className="overflow-hidden rounded-2xl border border-line bg-white">
              {sources.map((s) => {
                const on = !f.disabled.includes(s.id);
                const followed = f.followed.includes(s.id);
                return (
                  <div key={s.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                    <SourceIcon source={s} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cx('truncate text-[15px] font-semibold', on ? 'text-ink' : 'text-muted')} dir="auto">{s.name}</span>
                        <LangBadge lang={s.lang} />
                      </div>
                      <p className="truncate text-[12px] text-muted">
                        {topic(s.topic)} · {s.articleCount ?? 0} {t('articlesCount')}
                        {s.lastError ? <span className="text-brand"> · {t('failed')}</span> : s.lastFetchedAt ? ` · ${t('lastFetch')} ${rel(s.lastFetchedAt)}` : ''}
                      </p>
                    </div>
                    <button type="button" onClick={() => toggleFollow(s.id)} aria-label={followed ? t('following') : t('follow')} className={cx('grid h-9 w-9 place-items-center rounded-full transition hover:bg-stone-track', followed ? 'text-brand' : 'text-[#b3aaa0]')}>
                      <Star size={18} fill={followed ? 'currentColor' : 'none'} />
                    </button>
                    <button type="button" role="switch" aria-checked={on} onClick={() => toggleSource(s.id)} className={cx('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-brand' : 'bg-stone-deep')}>
                      <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Overlay>
  );
}

function Section({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-[17px] font-extrabold text-ink">{title}</h2>
      <div className="flex flex-wrap gap-2">{children}</div>
      {help && <p className="mt-3 text-[13px] leading-relaxed text-muted">{help}</p>}
    </section>
  );
}
