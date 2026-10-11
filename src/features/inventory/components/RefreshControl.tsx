import type { Dealership } from '@shared/api/dealerships';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { useFormatters } from '@/lib/use-formatters';
import { inventoryKeys } from '../api/inventory.queries';
import { useLastUpdated } from '../hooks/useLastUpdated';
import { useParsedSearch } from '../hooks/useParsedSearch';

type Props = {
  dealership: Dealership;
  /** More active queries to refetch with the dealership's, e.g. the open vehicle's detail. */
  alsoRefresh?: readonly QueryKey[];
};

/**
 * "Last updated HH:mm" and a manual "Refresh" (US-009). The time is the oldest load among the
 * KPIs, the aging section and the current list page (TA-31), in the dealership's time zone (TA-12)
 * and the current language's format. Deliberately no live region here (TA-31, single-announcer
 * rule): the time is plain text, so polls stay silent; a manual refresh is reported by the
 * button's "Refreshing…" label (focus stays on it) and the time changing when it finishes; a
 * failed refresh shows each section's existing quiet stale hint.
 *
 * Refresh refetches the dealership's active queries (summary, aging, list, facets) and
 * `alsoRefresh`, never another dealership (BR-04); data stays on screen meanwhile. The URL and
 * form input are not touched (AC-009.1). While busy the button is `aria-disabled` (not
 * `disabled`), so keyboard focus stays on it, like Save.
 */
export function RefreshControl({ dealership, alsoRefresh = [] }: Props) {
  const { t } = useTranslation();
  const { time } = useFormatters();
  const queryClient = useQueryClient();
  const { query } = useParsedSearch();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastUpdated = useLastUpdated([
    inventoryKeys.summary(dealership.id),
    inventoryKeys.aging(dealership.id),
    inventoryKeys.vehicles(dealership.id, query),
  ]);

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      // Active only: cached pages for other filters refetch when they are shown again.
      await Promise.all(
        [inventoryKeys.dealership(dealership.id), ...alsoRefresh].map((queryKey) =>
          queryClient.refetchQueries({ queryKey, type: 'active' }),
        ),
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex items-center gap-3 text-sm text-slate-600">
      {lastUpdated > 0 && (
        <p>
          <time dateTime={new Date(lastUpdated).toISOString()}>
            {t('inventory.refresh.lastUpdated', { time: time(lastUpdated, dealership.timeZone) })}
          </time>
        </p>
      )}
      <Button variant="secondary" size="sm" isLoading={isRefreshing} onClick={() => void refresh()}>
        {isRefreshing ? t('inventory.refresh.refreshing') : t('inventory.refresh.button')}
      </Button>
    </div>
  );
}
