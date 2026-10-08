import { useTranslation } from 'react-i18next';
import { useVehicleDetail } from '../api/vehicle-detail.queries';

type Props = { vehicleId: number };

/** "STK-1042 · Ford Focus" once loaded, "Vehicle details" until then (or on error). */
export function VehicleDetailTitle({ vehicleId }: Props) {
  const { t } = useTranslation();
  const { data } = useVehicleDetail(vehicleId);
  return data
    ? t('vehicleActions.dialog.title', {
        stockNumber: data.stockNumber,
        make: data.make,
        model: data.model,
      })
    : t('vehicleActions.dialog.fallbackTitle');
}
