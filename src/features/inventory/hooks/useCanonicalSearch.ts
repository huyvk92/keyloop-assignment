import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useParsedSearch } from './useParsedSearch';

/**
 * Replaces a hand-edited or stale URL with its canonical form: invalid, unknown or repeated
 * params dropped, defaults left out (TA-09). Call it once per page (the dashboard does), so a
 * dirty URL causes one replace navigation, not one per component reading the URL.
 */
export function useCanonicalSearch() {
  const { current, search } = useParsedSearch();
  const navigate = useNavigate();

  useEffect(() => {
    // Syncs the browser URL (an external system) with the cleaned query.
    if (search !== current)
      void navigate({ search: search ? `?${search}` : '' }, { replace: true });
  }, [current, search, navigate]);
}
