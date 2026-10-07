import { DealershipParamsSchema } from '@shared/api/dealerships';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PageSection } from '@/components/PageSection';
import { DealershipSelector, useDealership } from '@/features/dealerships';
import { VehicleTable } from '@/features/inventory';
import { shouldKeepFocus } from '@/lib/navigation-focus';

/** `/dealerships/:dealershipId`: the dealership comes from the path (ADR-008, AC-008.3). */
export function DashboardPage() {
  const { t } = useTranslation();
  const parsed = DealershipParamsSchema.safeParse(useParams());
  const dealershipId = parsed.success ? parsed.data.dealershipId : undefined;
  const { data: dealership, error, isPending, isError, refetch } = useDealership(dealershipId);
  // A switch from the selector keeps focus on the select; Back/links still focus the h1.
  const keepFocus = shouldKeepFocus(useLocation().state);

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
      <VehicleTable dealership={dealership} />
    </PageSection>
  );
}
