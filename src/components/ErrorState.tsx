import type { ComponentProps } from 'react';
import { Button } from '@/components/Button';
import { cn } from '@/lib/cn';
import { getErrorMessage } from '@/lib/error-messages';

type Props = Omit<ComponentProps<'div'>, 'title'> & {
  /** The thrown value; mapped to user-friendly text, never shown raw. */
  error: unknown;
  title?: string;
  /** Shows a "Retry" button when provided (e.g. a query's `refetch`). */
  onRetry?: () => void;
};

/** Error region with a mapped message and an optional Retry action (AC-001.6). */
export function ErrorState({
  error,
  title = "Couldn't load data",
  onRetry,
  className,
  ...props
}: Props) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-attention-200 bg-attention-50 p-4 text-attention-800',
        className,
      )}
      {...props}
    >
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm">{getErrorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={() => onRetry()}>
          Retry
        </Button>
      )}
    </div>
  );
}
