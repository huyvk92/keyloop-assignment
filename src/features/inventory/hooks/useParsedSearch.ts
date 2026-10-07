import { useMemo } from 'react';
import { useLocation } from 'react-router';
import { fromSearchParams } from '../lib/search-params';

/**
 * The current URL search read into the typed list query (TA-09). `current` is the raw search and
 * `search` its canonical form (both without `?`); they differ when the URL needs cleaning.
 */
export function useParsedSearch() {
  const current = useLocation().search.replace(/^\?/, '');
  // Memoised so the query (and setters built on it) stay referentially stable per URL.
  const parsed = useMemo(() => fromSearchParams(new URLSearchParams(current)), [current]);
  return { current, ...parsed };
}
