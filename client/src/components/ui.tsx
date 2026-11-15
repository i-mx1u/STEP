import {
  useEffect,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Loader2,
  PenLine,
  X,
} from 'lucide-react';
import { cn } from '../lib/format';
import type { Section } from '../types';

/* ── Buttons & badges ─────────────────────────────────────────── */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} aria-hidden="true" />;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  icon?: ReactNode;
  variant?: 'primary' | 'brand' | 'secondary' | 'ghost' | 'soft' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const variants = {
  primary: 'btn-primary',
  brand: 'btn-brand',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  soft: 'btn-soft',
  danger: 'btn-danger',
};

const sizes = {
  sm: 'btn-sm',
  md: '',
  lg: 'rounded-xl px-5 py-3 text-sm',
};

export function Button({
  loading,
  icon,
  variant = 'primary',
  size = 'md',
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function SectionPill({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const reading = section === 'reading';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
        reading
          ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100'
          : 'bg-mint-50 text-mint-700 ring-1 ring-inset ring-mint-100',
        className,
      )}
    >
      {reading ? <BookOpen className="h-3 w-3" /> : <PenLine className="h-3 w-3" />}
      {reading ? 'Reading' : 'Grammar'}
    </span>
  );
}

export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const tone =
    score >= 80
      ? 'bg-mint-50 text-mint-700 ring-mint-100'
      : score >= 60
        ? 'bg-amber-50 text-amber-700 ring-amber-100'
        : 'bg-rose-50 text-rose-600 ring-rose-100';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums ring-1 ring-inset',
        tone,
        className,
      )}
    >
      {score}%
    </span>
  );
}

export function BilingualLabel({
  en,
  ar,
  className,
  align = 'center',
}: {
  en: string;
  ar: string;
  className?: string;
  align?: 'center' | 'start';
}) {
  return (
    <span
      className={cn(
        'flex flex-col leading-tight',
        align === 'center' ? 'items-center' : 'items-start',
        className,
      )}
    >
      <span>{en}</span>
      <span
        dir="rtl"
        lang="ar"
        className="font-arabic mt-0.5 text-[10px] font-medium opacity-60"
      >
        {ar}
      </span>
    </span>
  );
}

/* ── Cards & layout ───────────────────────────────────────────── */

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="font-display text-3xl font-medium tracking-[-0.02em] text-ink-950 sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon,
  accent = 'brand',
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  icon: ReactNode;
  accent?: 'brand' | 'mint' | 'amber' | 'ink';
}) {
  const accents = {
    brand: 'bg-brand-50 text-brand-600',
    mint: 'bg-mint-50 text-mint-600',
    amber: 'bg-amber-50 text-amber-600',
    ink: 'bg-ink-100 text-ink-600',
  };
  return (
    <div className="surface flex items-start justify-between gap-3 p-4 sm:p-5">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400">
          {label}
        </p>
        <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink-950 sm:text-[28px]">
          {value}
        </p>
        {detail ? <p className="mt-1 text-xs text-ink-400">{detail}</p> : null}
      </div>
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          accents[accent],
        )}
      >
        {icon}
      </span>
    </div>
  );
}

export function ProgressBar({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-ink-100', className)}
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full bg-brand-500 transition-all duration-500', barClassName)}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'surface flex flex-col items-center justify-center px-6 py-14 text-center',
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-extrabold text-ink-900">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ── Score ring ───────────────────────────────────────────────── */

export function ScoreRing({
  score,
  size = 132,
  stroke = 10,
  className,
}: {
  score: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  const color =
    clamped >= 80 ? '#1e7f5e' : clamped >= 60 ? '#d97706' : '#e11d48';

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Score ${clamped} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(11,18,32,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[30px] font-extrabold leading-none tracking-tight text-ink-950">
          {clamped}
          <span className="text-base font-bold text-ink-400">%</span>
        </span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">
          Score
        </span>
      </div>
    </div>
  );
}

/* ── Modal & confirmation ─────────────────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-ink-950/45 backdrop-blur-[3px] animate-fade-in"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          'relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-lift animate-scale-in scroll-slim sm:rounded-3xl sm:p-6',
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="modal-title" className="text-lg font-extrabold text-ink-950">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm leading-relaxed text-ink-500">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children ? <div className="mt-5">{children}</div> : null}
        {footer ? <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  icon,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {icon ? (
        <div className="flex items-center gap-3 rounded-2xl bg-ink-50 p-3 text-sm text-ink-600">
          {icon}
        </div>
      ) : null}
    </Modal>
  );
}

/* ── Small controls ───────────────────────────────────────────── */

export function Switch({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  id?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-bold text-ink-800">
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-ink-400">{description}</p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand-600' : 'bg-ink-200',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function NumberStepper({
  value,
  min = 0,
  max = 200,
  step = 5,
  onChange,
  ariaLabel,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  const clamp = (next: number) => Math.max(min, Math.min(max, next));
  return (
    <div className="inline-flex items-center rounded-xl border border-ink-200 bg-white p-1 shadow-sm">
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-bold text-ink-500 transition hover:bg-ink-100 disabled:opacity-30"
        aria-label={`Decrease ${ariaLabel}`}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) ? clamp(parsed) : min);
        }}
        className="w-12 border-0 bg-transparent text-center text-sm font-extrabold tabular-nums text-ink-900 outline-none"
        aria-label={ariaLabel}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-bold text-ink-500 transition hover:bg-ink-100 disabled:opacity-30"
        aria-label={`Increase ${ariaLabel}`}
      >
        +
      </button>
    </div>
  );
}

export function InlineAlert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: 'info' | 'warn' | 'success';
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'border-brand-100 bg-brand-50/70 text-brand-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    success: 'border-mint-100 bg-mint-50 text-mint-900',
  };
  const icons = {
    info: AlertCircle,
    warn: AlertCircle,
    success: CheckCircle2,
  };
  const Icon = icons[tone];
  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border p-3 text-xs leading-relaxed',
        tones[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title ? <p className="font-bold">{title}</p> : null}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
    </div>
  );
}
