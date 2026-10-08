import { AGING_THRESHOLD_DAYS } from '@shared/api/vehicles';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { useFormatters } from '@/lib/use-formatters';
import { useVehicleDetail } from '../api/vehicle-detail.queries';
import { ActionHistory } from './ActionHistory';
import { LogActionSection } from './LogActionSection';
import { VehicleFacts } from './VehicleFacts';

type Props = { vehicleId: number };

/**
 * Body of the vehicle drawer with loading, error (Retry) and success states (AC-004.4). An aging
 * vehicle gets the "Log action" form; any other vehicle gets a short explanation instead, and
 * its history stays visible (AC-006.2, BR-09). A failed background refresh keeps the last details
 * (and the form with its input) and shows a quiet hint.
 */
export function VehicleDetailPanel({ vehicleId }: Props) {
  const { t } = useTranslation();
  const { integer } = useFormatters();
  const { data, error, isPending, refetch } = useVehicleDetail(vehicleId);

  if (isPending) return <LoadingState label={t('vehicleActions.dialog.loading')} rows={6} />;
  if (!data) {
    return (
      <ErrorState
        error={error}
        title={t('vehicleActions.dialog.loadError')}
        onRetry={() => void refetch()}
      />
    );
  }
  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-slate-600">{t('vehicleActions.dialog.refreshFailed')}</p>
      )}
      <VehicleFacts vehicle={data} />
      {data.isAging ? (
        <LogActionSection vehicle={data} />
      ) : (
        <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {t('vehicleActions.form.notAging', { days: integer(AGING_THRESHOLD_DAYS) })}
        </p>
      )}
      <ActionHistory actions={data.actions} timeZone={data.timeZone} />
    </div>
  );
}
