import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { PageSection } from '@/components/PageSection';
import { useDealerships } from '@/features/dealerships';

/** "/" opens the first dealership A-Z (AC-008.1). The API returns the list sorted by name. */
export function IndexRedirectPage() {
  const { t } = useTranslation();
  const { data, error, isPending, isError, refetch } = useDealerships();

  const first = data?.items[0];
  if (first) return <Navigate to={`/dealerships/${first.id}`} replace />;

  return (
    <PageSection title={t('app.title')}>
      {isPending && <LoadingState label={t('dealerships.loadingList')} />}
      {isError && (
        <ErrorState
          error={error}
          title={t('dealerships.loadErrorList')}
          onRetry={() => void refetch()}
        />
      )}
      {data && (
        <EmptyState
          title={t('dealerships.empty.title')}
          description={t('dealerships.empty.description')}
        />
      )}
    </PageSection>
  );
}
