import { ImageOff } from 'lucide-react';
import { cn, formatPassage } from '../lib/format';

export function PassageText({
  text,
  className,
  compact = false,
}: {
  text: string;
  className?: string;
  compact?: boolean;
}) {
  const { paragraphs, preserve } = formatPassage(text);

  if (!paragraphs.length) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-ink-50/60 px-5 py-8 text-center',
          className,
        )}
      >
        <ImageOff className="h-6 w-6 text-ink-300" />
        <p className="mt-2 text-sm font-bold text-ink-600">Image-based passage</p>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-ink-400">
          This passage comes from a chart or picture in the source file, so there is no
          text to display. The questions are still fully playable.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'passage-prose',
        preserve && 'whitespace-pre-line',
        compact && 'text-[15px] leading-[1.75]',
        className,
      )}
    >
      {preserve ? (
        paragraphs[0]
      ) : (
        paragraphs.map((paragraph, index) => (
          <p key={index} className={index > 0 ? 'mt-4' : undefined}>
            {paragraph}
          </p>
        ))
      )}
    </div>
  );
}
