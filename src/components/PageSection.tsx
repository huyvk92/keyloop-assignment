import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { usePageHeading } from '@/lib/use-page-heading';

type Props = {
  /** Page `<h1>` text; also used for `document.title`. */
  title: string;
  /** Optional content next to the heading (e.g. a selector or refresh control). */
  actions?: ReactNode;
  /** Move focus to the `<h1>` when the title changes (default true); see `usePageHeading`. */
  focusHeadingOnChange?: boolean;
  className?: string;
  children?: ReactNode;
};

/**
 * Route-level page wrapper: the page's single `<h1>`, which receives focus on navigation.
 * Deliberately not a landmark: it fills `<main>`, so a region named like the h1 would only wrap
 * the page's own section regions in a duplicate (T-038).
 */
export function PageSection({ title, actions, focusHeadingOnChange, className, children }: Props) {
  const headingRef = usePageHeading(title, { moveFocus: focusHeadingOnChange });
  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl font-bold tracking-tight focus:outline-none"
        >
          {title}
        </h1>
        {actions}
      </div>
      {children}
    </div>
  );
}
