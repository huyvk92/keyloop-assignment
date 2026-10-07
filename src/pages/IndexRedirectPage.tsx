import { Navigate } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PageSection } from '@/components/PageSection';
import { useDealerships } from '@/features/dealerships';

/** "/" opens the first dealership A-Z (AC-008.1). The API returns the list sorted by name. */
export function IndexRedirectPage() {
  const { data, error, isPending, isError, refetch } = useDealerships();

  const first = data?.items[0];
  if (first) return <Navigate to={`/dealerships/${first.id}`} replace />;

  return (
    <PageSection title="Inventory dashboard">
      {isPending && <LoadingState label="Loading dealerships…" />}
      {isError && (
        <ErrorState
          error={error}
          title="Couldn't load dealerships"
          onRetry={() => void refetch()}
        />
      )}
      {data && (
        <EmptyState
          title="No dealerships found"
          description="Add a dealership to start tracking inventory."
        />
      )}
    </PageSection>
  );
}
