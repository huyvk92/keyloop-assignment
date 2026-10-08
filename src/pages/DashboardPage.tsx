import { DealershipParamsSchema } from '@shared/api/dealerships';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PageSection } from '@/components/PageSection';
import { DealershipSelector, useDealership } from '@/features/dealerships';
import {
  AgingSection,
  FilterBar,
  KpiCards,
  LIST_REGION_ID,
  useCanonicalSearch,
  VehicleTable,
} from '@/features/inventory';
import { useVehicleSelection, VehicleDetailDialog } from '@/features/vehicle-actions';
import { shouldKeepFocus } from '@/lib/navigation-focus';

const listRegion = () => document.getElementById(LIST_REGION_ID);

/** `/dealerships/:dealershipId`: the dealership comes from the path (ADR-008, AC-008.3). */
export function DashboardPage() {
  const { t } = useTranslation();
  const parsed = DealershipParamsSchema.safeParse(useParams());
  const dealershipId = parsed.success ? parsed.data.dealershipId : undefined;
  const { data: dealership, error, isPending, isError, refetch } = useDealership(dealershipId);
  // A switch from the selector keeps focus on the select; Back/links still focus the h1.
  const keepFocus = shouldKeepFocus(useLocation().state);
  // The one owner of URL clean-up for the filters and the list (TA-09).
  useCanonicalSearch();
  // The open vehicle drawer is local page state, dropped on a dealership switch (TA-16).
  const { selectedVehicleId, selectVehicle, clearSelection } = useVehicleSelection(dealershipId);

  if (isPending) {
    return (
      <PageSection title={t('app.title')}>
        <LoadingState label={t('dealerships.loadingOne')} />
      </PageSection>
    );
  }
  if (isError) {
    return (
      <PageSection title={t('app.title')}>
        <ErrorState
          error={error}
          title={t('dealerships.loadErrorOne')}
          onRetry={() => void refetch()}
        />
      </PageSection>
    );
  }
  if (!dealership) {
    return (
      <PageSection title={t('dealerships.notFound.title')}>
        <p className="text-slate-600">{t('dealerships.notFound.description')}</p>
        <Link
          to="/"
          className="inline-block rounded text-brand-600 underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
        >
          {t('dealerships.notFound.link')}
        </Link>
      </PageSection>
    );
  }
  return (
    <PageSection
      title={dealership.name}
      focusHeadingOnChange={!keepFocus}
      actions={<DealershipSelector dealershipId={dealership.id} />}
    >
      {/* Page order: KPIs → aging section → filters + list, so the summary is visible without
          scrolling at 1280x800 and the aging stock follows (AC-005.4, AC-004.1). */}
      <KpiCards dealershipId={dealership.id} />
      <AgingSection dealershipId={dealership.id} onSelectVehicle={selectVehicle} />
      {/* Keyed by dealership: a switch drops the search draft and any pending debounce (TA-10). */}
      <FilterBar key={dealership.id} dealershipId={dealership.id} />
      <VehicleTable dealership={dealership} onSelectVehicle={selectVehicle} />
      {/* If the opening row is gone on close (e.g. a saved action took the vehicle out of a
          "Needs attention" list), focus goes to the list region it was in (ADR-006). */}
      <VehicleDetailDialog
        vehicleId={selectedVehicleId}
        onClose={clearSelection}
        returnFocusFallback={listRegion}
      />
    </PageSection>
  );
}
