import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

type Props = Omit<ComponentProps<'div'>, 'title'> & {
  title: string;
  description?: string;
  /**
   * Announce the message as a status (default). Pass `false` when another live region already
   * announces the same outcome, so it isn't read twice.
   */
  announce?: boolean;
};

/** Message shown when a list has no items; `children` is an optional action slot. */
export function EmptyState({
  title,
  description,
  announce = true,
  className,
  children,
  ...props
}: Props) {
  return (
    <div
      role={announce ? 'status' : undefined}
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 p-8 text-center',
        className,
      )}
      {...props}
    >
      <p className="font-semibold text-slate-900">{title}</p>
      {description && <p className="text-sm text-slate-600">{description}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
