import { useEffect, useRef } from 'react';

const APP_TITLE = 'Inventory dashboard';

/**
 * Sets `document.title` and moves focus to the page's `<h1>` whenever the title changes
 * (skill section 8). Attach the returned ref to an `<h1 tabIndex={-1}>`.
 */
export function usePageHeading(title: string) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = title === APP_TITLE ? APP_TITLE : `${title} · ${APP_TITLE}`;
    headingRef.current?.focus();
  }, [title]);

  return headingRef;
}
