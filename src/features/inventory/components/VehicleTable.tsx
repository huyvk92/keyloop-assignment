import type { Dealership } from '@shared/api/dealerships';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { useVehicleList } from '../api/inventory.queries';
import { useInventorySearchParams } from '../hooks/useInventorySearchParams';
import { FILTER_REGION_ID } from '../lib/search-params';
import { Pagination } from './Pagination';
import { VehicleTableView } from './VehicleTableView';

type Props = { dealership: Dealership };

/**
 * Paged inventory list for the filters in the URL, with loading, error (Retry), empty
 * ("No vehicles in stock" or "No vehicles match your filters") and success states
 * (AC-001.4..6, AC-002.8).
 */
export function VehicleTable({ dealership }: Props) {
  const { t } = useTranslation();
  const { query, hasFilters, setPage, clearFilters, searchFor } = useInventorySearchParams(
    dealership.id,
  );
  const { page } = query;
  const { data, error, isPending, isPlaceholderData, refetch } = useVehicleList(
    dealership.id,
    query,
  );

  // An empty placeholder has nothing worth keeping on screen, and its empty state would be the
  // wrong one for the new filters (e.g. "No vehicles in stock" flashing after Clear filters).
  if (isPending || (isPlaceholderData && data.total === 0)) {
    return <LoadingState label={t('inventory.list.loading')} rows={6} />;
  }
  if (!data) {
    return (
      <ErrorState
        error={error}
        title={t('inventory.list.loadError')}
        onRetry={() => void refetch()}
      />
    );
  }
  if (data.total === 0 && hasFilters) {
    // Distinct from "No vehicles in stock": the stock exists, the filters exclude it (AC-002.8).
    // The filter bar's match count ("0 vehicles match…") already announces this outcome.
    return (
      <EmptyState
        announce={false}
        title={t('inventory.list.noMatch.title')}
        description={t('inventory.list.noMatch.description')}
      >
        <Button
          variant="secondary"
          onClick={() => {
            clearFilters();
            // This button unmounts with the empty state; keep focus near the filters.
            document.getElementById(FILTER_REGION_ID)?.focus();
          }}
        >
          {t('inventory.list.noMatch.clear')}
        </Button>
      </EmptyState>
    );
  }
  if (data.total === 0) {
    return (
      <EmptyState
        title={t('inventory.list.empty.title')}
        description={t('inventory.list.empty.description', { dealership: dealership.name })}
      />
    );
  }

  const lastPage = Math.ceil(data.total / data.pageSize);
  if (data.items.length === 0 && page > lastPage) {
    // A page past the end (stale bookmark, stock sold) jumps to the last page (TA-05).
    return <Navigate to={{ search: searchFor(lastPage) }} replace />;
  }

  return (
    <div className="space-y-3">
      <VehicleTableView vehicles={data.items} dealership={dealership} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          onPageChange={setPage}
        />
        {/* A visible hint only, not a live region: the filter bar's match count is the single
            announcer of result changes, and the 60 s background poll announces nothing. A failed
            background refresh keeps the list and shows this quiet hint, not an alert. */}
        <p className="text-sm text-slate-600">
          {isPlaceholderData
            ? t('inventory.list.updating')
            : error
              ? t('inventory.list.refreshFailed')
              : ''}
        </p>
      </div>
    </div>
  );
}
