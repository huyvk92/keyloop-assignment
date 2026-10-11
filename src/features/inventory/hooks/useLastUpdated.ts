import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * The OLDEST `dataUpdatedAt` (epoch ms) among the given queries that have data, 0 before any has
 * data (TA-31): "Last updated" must never claim newer data than the oldest part on screen, e.g.
 * when the list's refetch fails while the KPIs refresh. Queries without data yet (a new filter's
 * list still loading) are left out. Reads the query cache directly instead of adding observers,
 * so it never triggers a fetch or a second polling timer; it re-renders on every cache event and
 * returns a number, so unchanged values don't re-render.
 */
export function useLastUpdated(queryKeys: readonly QueryKey[]): number {
  const queryClient = useQueryClient();
  const subscribe = useCallback(
    (onChange: () => void) => queryClient.getQueryCache().subscribe(onChange),
    [queryClient],
  );
  const oldest = () => {
    const times = queryKeys
      .map((key) => queryClient.getQueryState(key)?.dataUpdatedAt ?? 0)
      .filter((time) => time > 0);
    return times.length > 0 ? Math.min(...times) : 0;
  };
  return useSyncExternalStore(subscribe, oldest);
}
