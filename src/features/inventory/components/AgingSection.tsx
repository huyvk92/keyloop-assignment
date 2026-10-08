import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { useFormatters } from '@/lib/use-formatters';
import { useAgingStock } from '../api/inventory.queries';
import { useInventorySearchParams } from '../hooks/useInventorySearchParams';
import { LIST_HEADING_ID } from '../lib/search-params';
import { AgingList } from './AgingList';

type Props = {
  dealershipId: number;
  /** Opens a vehicle (AC-004.4); without it the items are plain text. */
  onSelectVehicle?: (vehicleId: number) => void;
};

/**
 * "Aging stock" (US-004): the dealership's 10 oldest vehicles over 90 days with age and current
 * action, independent of the list's filters (AC-004.1, TA-11), with loading, error (Retry),
 * empty ("No aging stock", AC-004.2) and success states. "View all N aging vehicles" replaces
 * the list's filters with Aging only (AC-004.3, TA-29) and moves focus to the list's heading.
 *
 * Adds no live region of its own (loading is `aria-busy` on the section, not a status): the filter
 * bar's match count is the single announcer of result changes. A failed background refresh keeps
 * the last loaded vehicles and shows a quiet hint, like the list.
 */
export function AgingSection({ dealershipId, onSelectVehicle }: Props) {
  const { t } = useTranslation();
  const { integer } = useFormatters();
  const headingId = useId();
  const { data, error, isPending, refetch } = useAgingStock(dealershipId);
  const { replaceFilters } = useInventorySearchParams(dealershipId);

  const viewAll = () => {
    // Only agingOnly, so the list shows exactly the N the button promises (TA-29).
    replaceFilters({ agingOnly: true });
    // The list's heading stays mounted while its results load, so focus lands on the results.
    document.getElementById(LIST_HEADING_ID)?.focus();
  };

  let body: ReactNode;
  if (isPending) {
    body = (
      <LoadingState
        announce={false}
        label={t('inventory.aging.loading')}
        rows={3}
        className="py-2"
      />
    );
  } else if (!data) {
    body = (
      <ErrorState
        error={error}
        title={t('inventory.aging.loadError')}
        onRetry={() => void refetch()}
      />
    );
  } else if (data.total === 0) {
    body = (
      <EmptyState
        announce={false}
        title={t('inventory.aging.empty.title')}
        description={t('inventory.aging.empty.description')}
        className="p-4"
      />
    );
  } else {
    body = <AgingList vehicles={data.items} onSelectVehicle={onSelectVehicle} />;
  }

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={isPending || undefined}
      className="space-y-2 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-lg font-semibold text-slate-900">
          {t('inventory.aging.title')}
        </h2>
        {data && data.total > 0 && (
          <Button variant="secondary" size="sm" onClick={viewAll}>
            {t('inventory.aging.viewAll', { count: data.total, total: integer(data.total) })}
          </Button>
        )}
      </div>
      {body}
      {/* A visible hint only, not a live region, like the list's (see above). */}
      {error && data && (
        <p className="text-sm text-slate-600">{t('inventory.aging.refreshFailed')}</p>
      )}
    </section>
  );
}
