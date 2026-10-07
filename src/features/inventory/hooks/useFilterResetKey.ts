import { useState } from 'react';
import { useLocation } from 'react-router';
import { isFiltersClearedState } from '../lib/search-params';

/**
 * A number that changes on every "Clear filters" navigation (AC-002.8). Used as the `key` of
 * controls holding unapplied drafts (search box, age range form), so clearing remounts them
 * empty even when the URL value they follow did not change.
 */
export function useFilterResetKey(): number {
  const { key, state } = useLocation();
  const [seenKey, setSeenKey] = useState(key);
  const [resetKey, setResetKey] = useState(0);
  // Adjust state while rendering when the location changes (React docs pattern, no effect).
  if (key !== seenKey) {
    setSeenKey(key);
    if (isFiltersClearedState(state)) setResetKey((count) => count + 1);
  }
  return resetKey;
}
