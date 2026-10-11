import { useEffect, useState } from 'react';

/** Search input debounce (TA-08). */
export const SEARCH_DEBOUNCE_MS = 300;

/** What a draft commits as: trimmed, and blank means "no search" (BR-08). */
export const normalizeSearch = (text: string): string | undefined => text.trim() || undefined;

type Committed = string | undefined;

/**
 * Local draft for a debounced search box. `committed` is the value in the URL; `onCommit` is
 * called once typing pauses for `SEARCH_DEBOUNCE_MS` with the normalised draft.
 *
 * The hook remembers the values it committed that the URL hasn't shown yet. When one of them
 * arrives it is this hook's own commit landing (possibly late, after the user typed more, e.g.
 * while the navigation is held back under load), so the draft is kept: no keystroke is lost.
 * Any other change of `committed` is external (Clear filters, Back/Forward, "View all"): the
 * draft follows it, unless the draft already normalises to that value, so a trailing space typed
 * mid-word isn't removed under the cursor. An external change also forgets the pending commits.
 */
export function useSearchDraft(committed: Committed, onCommit: (value: Committed) => void) {
  const [draft, setDraft] = useState(committed ?? '');
  const [seen, setSeen] = useState(committed);
  // Commits sent but not yet seen in `committed`, oldest first.
  const [sent, setSent] = useState<readonly Committed[]>([]);

  // Adjust state while rendering when the prop changes (React docs pattern, no effect needed).
  if (committed !== seen) {
    setSeen(committed);
    const own = sent.indexOf(committed);
    if (own >= 0) {
      // Earlier commits that never showed were superseded by this one.
      setSent(sent.slice(own + 1));
    } else {
      setSent([]);
      if (normalizeSearch(draft) !== committed) setDraft(committed ?? '');
    }
  }

  const pending = normalizeSearch(draft);
  useEffect(() => {
    // A timer is an external system: start it when the draft differs, cancel it on change.
    if (pending === committed) return;
    const timer = setTimeout(() => {
      setSent((list) => [...list, pending]);
      onCommit(pending);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [pending, committed, onCommit]);

  return { draft, setDraft };
}
