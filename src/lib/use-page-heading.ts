import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

type Options = {
  /**
   * Move focus to the heading when the title changes (default `true`). Pass `false` when the
   * change came from an in-page control that should keep focus (see `navigation-focus.ts`).
   * The first render always focuses the heading.
   */
  moveFocus?: boolean | undefined;
};

/**
 * Sets `document.title` and moves focus to the page's `<h1>` whenever the title changes
 * (skill section 8). Attach the returned ref to an `<h1 tabIndex={-1}>`.
 *
 * `title` is already translated by the caller. A language switch re-translates the document
 * title (AC-015.2) but does not move focus: the user is still on the language switcher.
 */
export function usePageHeading(title: string, { moveFocus = true }: Options = {}) {
  const { t, i18n } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const appTitle = t('app.title');
  const documentTitle = title === appTitle ? appTitle : t('app.documentTitle', { page: title });
  const language = i18n.language;
  /** What the last run saw; `null` before the first run. */
  const previous = useRef<{ title: string; language: string } | null>(null);

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  useEffect(() => {
    const before = previous.current;
    previous.current = { title, language };
    if (before === null) {
      headingRef.current?.focus();
      return;
    }
    // The heading text changed because of a language switch, not a navigation.
    if (before.language !== language) return;
    // Only `moveFocus` changed (e.g. a later search-param navigation): nothing to announce.
    if (before.title === title) return;
    if (moveFocus) headingRef.current?.focus();
  }, [title, language, moveFocus]);

  return headingRef;
}
