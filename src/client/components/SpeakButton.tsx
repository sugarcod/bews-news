import { Square, Volume2 } from 'lucide-react';
import { useSpeak, type SpeakLang } from '../../lib/tts.ts';
import { useI18n, type TKey } from '../i18n.ts';
import { cx } from './ui.tsx';

interface Props {
  text: string;
  lang: SpeakLang;
  size?: 'xs' | 'sm' | 'md';
  labelKey?: TKey;
  className?: string;
}

const SIZES = { xs: { box: 'h-[22px] w-[22px]', icon: 12 }, sm: { box: 'h-8 w-8', icon: 15 }, md: { box: 'h-10 w-10', icon: 18 } };

/** 🔊 button: idle → loading (spinner ring) → playing (terracotta, tap to stop). */
export function SpeakButton({ text, lang, size = 'sm', labelKey = 'listen', className }: Props) {
  const { t } = useI18n();
  const { state, toggle } = useSpeak(text, lang);
  const sz = SIZES[size];
  const label = state === 'playing' ? t('stopAudio') : state === 'loading' ? t('loadingAudio') : t(labelKey);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggle(); }}
      onMouseDown={(e) => e.preventDefault() /* keep any text selection intact */}
      aria-label={label}
      title={label}
      aria-pressed={state === 'playing'}
      dir="ltr"
      className={cx(
        'speak-btn relative inline-grid shrink-0 select-none place-items-center rounded-full border align-middle transition active:scale-95',
        sz.box,
        state === 'playing'
          ? 'border-brand bg-brand text-white shadow-[0_3px_10px_-3px_rgba(162,53,38,0.7)]'
          : state === 'loading'
            ? 'border-brand/50 bg-brand-soft text-brand'
            : 'border-line bg-white text-muted hover:border-brand hover:text-brand',
        className,
      )}
    >
      {state === 'loading' && <span className="absolute inset-[-2px] animate-spin rounded-full border-2 border-brand border-r-transparent" />}
      {state === 'playing' ? <Square size={sz.icon - 3} fill="currentColor" strokeWidth={0} /> : <Volume2 size={sz.icon} strokeWidth={2.2} />}
      {state === 'playing' && <span className="speak-pulse pointer-events-none absolute inset-0 rounded-full" />}
    </button>
  );
}
