import type { VehicleDetail } from '@shared/api/vehicles';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useLogAction } from '../hooks/useLogAction';
import { LogActionForm } from './LogActionForm';

type Props = { vehicle: VehicleDetail };

/** The "Log action" form of an aging vehicle, wired to the POST mutation (US-006). */
export function LogActionSection({ vehicle }: Props) {
  const { t } = useTranslation();
  const headingId = useId();
  const { mutateAsync } = useLogAction({
    vehicleId: vehicle.id,
    dealershipId: vehicle.dealershipId,
  });
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h3 id={headingId} className="text-base font-semibold text-slate-900">
        {t('vehicleActions.form.title')}
      </h3>
      <LogActionForm onSubmit={mutateAsync} />
    </section>
  );
}
