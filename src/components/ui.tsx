import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  label: string;
  active?: boolean;
  size?: 'md' | 'lg';
};

/** Round icon button with a ≥44 px hit area and an accessible label. */
export function IconButton({ icon, label, active, size = 'md', className = '', ...rest }: IconButtonProps) {
  const dim = size === 'lg' ? 'h-14 w-14' : 'h-11 w-11';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${dim} inline-flex shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 ${
        active ? 'bg-accent text-ink' : 'bg-white/10 text-white active:bg-white/20'
      } ${className}`}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-accent text-ink active:bg-accent-soft',
    secondary: 'bg-white/10 text-white active:bg-white/20',
    ghost: 'bg-transparent text-white/80 active:bg-white/10',
    danger: 'bg-red-500/90 text-white active:bg-red-500',
  }[variant];
  return (
    <button
      type="button"
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${styles} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Screen header with a back button, safe-area aware. */
export function Header({ title, onBack, right, large }: { title: string; onBack?: () => void; right?: ReactNode; large?: boolean }) {
  if (large) {
    return (
      <header className="sticky top-0 z-20 flex items-end gap-2 bg-ink/90 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur">
        <h1 className="flex-1 truncate text-[30px] font-bold leading-tight">{title}</h1>
        <div className="flex gap-1">{right}</div>
      </header>
    );
  }
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 bg-ink/90 px-2 pb-2 pt-[calc(env(safe-area-inset-top)+8px)] backdrop-blur">
      {onBack ? <IconButton icon="back" label="Back" onClick={onBack} className="bg-transparent" /> : <span className="w-11" />}
      <h1 className="flex-1 truncate text-center text-[17px] font-semibold">{title}</h1>
      <div className="flex min-w-11 justify-end">{right}</div>
    </header>
  );
}

/** Bottom sheet dialog with focus handling and Escape to close. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/60" onClick={onClose} tabIndex={-1} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-ink-800 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 shadow-2xl outline-none motion-safe:animate-[sheet_200ms_ease-out]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <h2 className="mb-3 text-center text-[15px] font-semibold text-white/80">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function SheetItem({ icon, label, hint, onClick }: { icon: IconName; label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[56px] w-full items-center gap-4 rounded-2xl px-3 text-left active:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
        <Icon name={icon} />
      </span>
      <span className="flex-1">
        <span className="block text-[16px] font-medium">{label}</span>
        {hint && <span className="block text-[13px] text-white/55">{hint}</span>}
      </span>
    </button>
  );
}

export function Spinner({ label = 'Working…' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white motion-safe:animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex min-h-[56px] cursor-pointer items-center gap-4 px-4 py-2">
      <span className="flex-1">
        <span className="block text-[16px]">{label}</span>
        {hint && <span className="block text-[13px] text-white/55">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-full bg-white/20 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent"
      />
    </label>
  );
}

export function Section({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`mb-6 ${className}`}>
      {title && <h2 className="mb-1 px-4 text-[13px] font-semibold uppercase tracking-wide text-white/45">{title}</h2>}
      <div className="divide-y divide-white/10 rounded-2xl bg-white/5">{children}</div>
    </section>
  );
}

export function Row({ label, hint, onClick, icon = 'arrow' }: { label: string; hint?: string; onClick: () => void; icon?: IconName }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left active:bg-white/5">
      <span className="flex-1">
        <span className="block text-[16px]">{label}</span>
        {hint && <span className="block text-[13px] text-white/55">{hint}</span>}
      </span>
      <Icon name={icon} size={18} className="text-white/40" />
    </button>
  );
}

/** Labelled form field. `unsure` highlights values the scanner wasn't sure about. */
export function Field({
  label,
  hint,
  unsure,
  children,
}: {
  label: string;
  hint?: ReactNode;
  unsure?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`block px-4 py-2.5 ${unsure ? 'bg-warn/10' : ''}`}>
      <span className="flex items-center gap-2 text-[13px] text-white/55">
        {label}
        {unsure && <span className="rounded-full bg-warn px-2 text-[11px] font-semibold text-ink">Check</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[12px] leading-snug text-white/50">{hint}</span>}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return <input {...rest} className={`mt-0.5 block min-h-[40px] w-full bg-transparent text-[17px] text-white placeholder:text-white/30 focus:outline-none ${className}`} />;
}

export function Chip({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      onClick={onClick}
      className={`min-h-[36px] shrink-0 rounded-full px-4 text-[14px] font-medium transition-colors ${active ? 'bg-paper text-ink' : 'bg-white/10 text-white/80 active:bg-white/20'}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-8 py-14 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-white/60">
        <Icon name={icon} size={30} />
      </span>
      <h2 className="text-[19px] font-semibold">{title}</h2>
      {children}
    </div>
  );
}
