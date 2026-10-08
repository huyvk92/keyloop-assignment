/**
 * Freshness of polled server data (ADR-007, NFR-05, TA-14): refetch exactly every 60 s, only while
 * the tab is visible, and when the window regains focus. Spread into `queryOptions`.
 */
export const POLL_INTERVAL_MS = 60_000;

export const POLLING = {
  refetchInterval: POLL_INTERVAL_MS,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
} as const;
