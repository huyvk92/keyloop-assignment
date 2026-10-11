import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'aging' | 'attention';

const tones = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  aging: 'border-aging-200 bg-aging-50 text-aging-800',
  attention: 'border-attention-200 bg-attention-50 text-attention-800',
} satisfies Record<Tone, string>;

type Props = ComponentProps<'span'> & {
  tone?: Tone;
  /** Decorative icon; hidden from assistive technologies. The text label carries the meaning. */
  icon?: ReactNode;
};

/** Status pill. Always pass a visible text label as children: never colour alone (NFR-01). */
export function Badge({ tone = 'neutral', icon, className, children, ...props }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
      {...props}
    >
      {icon && (
        <span aria-hidden="true" className="inline-flex size-3.5 shrink-0">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
