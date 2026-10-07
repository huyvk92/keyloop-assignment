import type { Dealership } from '@shared/api/dealerships';
import { VehicleListQuerySchema } from '@shared/api/vehicles';
import { Navigate } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { useVehicleList } from '../api/inventory.queries';
import { usePageParam } from '../hooks/usePageParam';
import { Pagination } from './Pagination';
import { VehicleTableView } from './VehicleTableView';

type Props = { dealership: Dealership };

/** Paged inventory list with loading, error (Retry), empty and success states (AC-001.4..6). */
export function VehicleTable({ dealership }: Props) {
  const { page, setPage, searchFor } = usePageParam();
  const query = VehicleListQuerySchema.parse({ page });
  const { data, error, isPending, isPlaceholderData, refetch } = useVehicleList(
    dealership.id,
    query,
  );

  if (isPending) return <LoadingState label="Loading vehicles…" rows={6} />;
  if (!data) {
    return (
      <ErrorState error={error} title="Couldn't load vehicles" onRetry={() => void refetch()} />
    );
  }
  if (data.total === 0) {
    return (
      <EmptyState
        title="No vehicles in stock"
        description={`${dealership.name} has no vehicles in stock right now.`}
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
        {/* Only user-triggered loads (page change) are announced, not the 60 s background poll;
            a failed background refresh keeps the list and shows a quiet hint, not an alert. */}
        <p role="status" className="text-sm text-slate-600">
          {isPlaceholderData
            ? 'Updating…'
            : error
              ? "Couldn't refresh the list. Showing the last loaded data."
              : ''}
        </p>
      </div>
    </div>
  );
}
