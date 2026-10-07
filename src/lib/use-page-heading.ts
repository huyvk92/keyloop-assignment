import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Sets `document.title` and moves focus to the page's `<h1>` whenever the title changes
 * (skill section 8). Attach the returned ref to an `<h1 tabIndex={-1}>`.
 *
 * `title` is already translated by the caller. A language switch re-translates the document
 * title (AC-015.2) but does not move focus: the user is still on the language switcher.
 */
export function usePageHeading(title: string) {
  const { t, i18n } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const appTitle = t('app.title');
  const documentTitle = title === appTitle ? appTitle : t('app.documentTitle', { page: title });
  const language = i18n.language;
  const focusedLanguage = useRef(language);

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  useEffect(() => {
    if (focusedLanguage.current !== language) {
      // The heading text changed because of a language switch, not a navigation.
      focusedLanguage.current = language;
      return;
    }
    headingRef.current?.focus();
  }, [title, language]);

  return headingRef;
}
