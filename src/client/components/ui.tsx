import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { useEffect } from 'react';
import type { NewsLang, SourceInfo } from '../../shared/types.ts';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function CircleButton({ children, className, badge, solid, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { badge?: number; solid?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:scale-95',
        solid ? 'bg-brand text-white shadow-[0_4px_12px_-4px_rgba(162,53,38,0.6)] hover:bg-brand-dark' : 'border border-line bg-white text-ink hover:border-[#d8cfc3]',
        className,
      )}
    >
      {children}
      {!!badge && (
        <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10.5px] font-bold leading-none text-white ring-2 ring-cream">
          {badge}
        </span>
      )}
    </button>
  );
}

export function Pill({ active, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'rounded-full border px-4 py-2 text-[14px] font-medium transition active:scale-[0.97]',
        active ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-white text-ink hover:border-[#d8cfc3]',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md' }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; size?: 'md' | 'lg' }) {
  return (
    <div className={cx('flex rounded-full bg-stone-tabs p-1', size === 'lg' && 'bg-stone-track')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-full font-semibold transition',
            size === 'lg' ? 'py-2.5 text-[15px]' : 'py-2 text-[14px]',
            value === o.value ? 'bg-white text-ink shadow-[0_1px_3px_rgba(26,24,22,0.12)]' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SourceIcon({ source, size = 22 }: { source?: SourceInfo; size?: number }) {
  if (!source) return <span className="inline-block rounded-md bg-stone-deep" style={{ width: size, height: size }} />;
  const len = source.monogram.length;
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-[6px] font-extrabold leading-none text-white"
      style={{ width: size, height: size, background: source.color, fontSize: size * (len >= 3 ? 0.34 : len === 2 ? 0.42 : 0.55) }}
      aria-hidden
    >
      {source.monogram}
    </span>
  );
}

export function LangBadge({ lang }: { lang: NewsLang }) {
  return (
    <span className={cx('rounded-[5px] border px-1.5 py-[1px] text-[10px] font-bold tracking-wide', lang === 'he' ? 'border-[#d9cdbd] bg-[#F5EFE6] text-[#7a5b3a]' : 'border-line bg-white text-muted')}>
      {lang.toUpperCase()}
    </span>
  );
}

export function Overlay({ children, onClose, z = 40 }: { children: ReactNode; onClose?: () => void; z?: number }) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 flex justify-center bg-black/10" style={{ zIndex: z }}>
      <div className="slide-in flex h-full w-full max-w-[720px] flex-col overflow-hidden bg-cream md:border-x md:border-line">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">{icon}</div>
      <p className="text-[16px] font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1.5 max-w-xs text-[14px] leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} />;
}
