import { DealershipParamsSchema } from '@shared/api/dealerships';
import { Link, useParams } from 'react-router';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PageSection } from '@/components/PageSection';
import { useDealership } from '@/features/dealerships';
import { VehicleTable } from '@/features/inventory';

/** `/dealerships/:dealershipId`: the dealership comes from the path (ADR-008, AC-008.3). */
export function DashboardPage() {
  const parsed = DealershipParamsSchema.safeParse(useParams());
  const dealershipId = parsed.success ? parsed.data.dealershipId : undefined;
  const { data: dealership, error, isPending, isError, refetch } = useDealership(dealershipId);

  if (isPending) {
    return (
      <PageSection title="Inventory dashboard">
        <LoadingState label="Loading dealership…" />
      </PageSection>
    );
  }
  if (isError) {
    return (
      <PageSection title="Inventory dashboard">
        <ErrorState error={error} title="Couldn't load dealership" onRetry={() => void refetch()} />
      </PageSection>
    );
  }
  if (!dealership) {
    return (
      <PageSection title="Dealership not found">
        <p className="text-slate-600">
          This dealership doesn&apos;t exist or is no longer available.
        </p>
        <Link
          to="/"
          className="inline-block rounded text-brand-600 underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
        >
          Go to the dashboard
        </Link>
      </PageSection>
    );
  }
  return (
    <PageSection title={dealership.name}>
      <VehicleTable dealership={dealership} />
    </PageSection>
  );
}
