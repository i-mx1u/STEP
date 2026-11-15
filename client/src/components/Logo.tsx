import { Link } from 'react-router-dom';
import { cn } from '../lib/format';

export function LogoMark({
  className,
  tone = 'dark',
}: {
  className?: string;
  tone?: 'dark' | 'light';
}) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl',
        tone === 'dark' ? 'bg-ink-950' : 'bg-white',
        className ?? 'h-10 w-10',
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" className="h-[72%] w-[72%]" fill="none">
        <rect
          x="8"
          y="24"
          width="6"
          height="8"
          rx="1.6"
          fill={tone === 'dark' ? '#7b90aa' : '#0b1220'}
        />
        <rect
          x="17"
          y="18"
          width="6"
          height="14"
          rx="1.6"
          fill={tone === 'dark' ? '#bed2ff' : '#2548e8'}
        />
        <rect
          x="26"
          y="10"
          width="6"
          height="22"
          rx="1.6"
          fill={tone === 'dark' ? '#ffffff' : '#0b1220'}
        />
        <circle cx="29" cy="7" r="2.6" fill="#3b66f6" />
      </svg>
    </span>
  );
}

export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      to="/"
      className={cn('group inline-flex items-center gap-3', className)}
      aria-label="STEPWISE home"
    >
      <LogoMark className="h-10 w-10 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105" />
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-extrabold tracking-[0.16em] text-ink-950">
          STEPWISE
        </span>
        {!compact ? (
          <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.22em] text-ink-400">
            STEP Practice Studio
          </span>
        ) : null}
      </span>
    </Link>
  );
}
