import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { usePageHeading } from '@/lib/use-page-heading';

type Props = {
  /** Page `<h1>` text; also used for `document.title`. */
  title: string;
  /** Optional content next to the heading (e.g. a selector or refresh control). */
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
};

/** Route-level page wrapper: labelled section, `<h1>` that receives focus on navigation. */
export function PageSection({ title, actions, className, children }: Props) {
  const headingId = useId();
  const headingRef = usePageHeading(title);
  return (
    <section aria-labelledby={headingId} className={cn('space-y-6', className)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl font-bold tracking-tight focus:outline-none"
        >
          {title}
        </h1>
        {actions}
      </div>
      {children}
    </section>
  );
}
