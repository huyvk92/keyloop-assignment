import { useEffect, useState } from 'react';

/** Search input debounce (TA-08). */
export const SEARCH_DEBOUNCE_MS = 300;

/** What a draft commits as: trimmed, and blank means "no search" (BR-08). */
export const normalizeSearch = (text: string): string | undefined => text.trim() || undefined;

/**
 * Local draft for a debounced search box. `committed` is the value in the URL; `onCommit` is
 * called once typing pauses for `SEARCH_DEBOUNCE_MS` with the normalised draft.
 *
 * When the committed value changes from outside (Clear filters, Back), the draft follows it,
 * unless the draft already normalises to that value: then the user's own spacing is kept, so a
 * trailing space typed mid-word isn't removed under their cursor.
 */
export function useSearchDraft(
  committed: string | undefined,
  onCommit: (value: string | undefined) => void,
) {
  const [draft, setDraft] = useState(committed ?? '');
  const [seen, setSeen] = useState(committed);

  // Adjust state while rendering when the prop changes (React docs pattern, no effect needed).
  if (committed !== seen) {
    setSeen(committed);
    if (normalizeSearch(draft) !== committed) setDraft(committed ?? '');
  }

  const pending = normalizeSearch(draft);
  useEffect(() => {
    // A timer is an external system: start it when the draft differs, cancel it on change.
    if (pending === committed) return;
    const timer = setTimeout(() => onCommit(pending), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [pending, committed, onCommit]);

  return { draft, setDraft };
}
