import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

type Props = ComponentProps<'div'> & {
  /** Text announced to assistive technologies. */
  label?: string;
  /** Number of skeleton lines to show. */
  rows?: number;
};

/** Skeleton placeholder for a loading region (`role="status"`, `aria-busy`). */
export function LoadingState({ label = 'Loading…', rows = 3, className, ...props }: Props) {
  // Fixed-length placeholder list that never reorders, so positional keys are stable.
  const lines = Array.from({ length: rows }, (_, i) => `skeleton-${i}`);
  return (
    <div role="status" aria-busy="true" className={cn('space-y-3 py-4', className)} {...props}>
      <span className="sr-only">{label}</span>
      {lines.map((key) => (
        <div
          key={key}
          aria-hidden="true"
          className="h-4 animate-pulse rounded bg-slate-200 last:w-2/3 motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}
