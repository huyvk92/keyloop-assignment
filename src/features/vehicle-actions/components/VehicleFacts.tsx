import type { VehicleDetail } from '@shared/api/vehicles';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AgingBadge } from '@/features/inventory';
import type { en } from '@/i18n/resources/en';
import { useFormatters } from '@/lib/use-formatters';

type Props = { vehicle: VehicleDetail };

type HeaderId = keyof typeof en.inventory.table.header;

/**
 * The vehicle's facts and current action (AC-004.4, BR-14) as a description list. Labels reuse
 * the table's headers so both read the same; vehicle data is shown as stored (BR-19), prices in
 * the dealership's currency and timestamps in its time zone.
 */
export function VehicleFacts({ vehicle: v }: Props) {
  const { t } = useTranslation();
  const format = useFormatters();
  const header = (id: HeaderId) => t(`inventory.table.header.${id}`);
  const facts: [label: string, value: ReactNode][] = [
    [
      header('currentAction'),
      v.currentAction ? (
        <>
          <span className="block font-medium">{t(`actionStatus.${v.currentAction.status}`)}</span>
          <span className="block text-xs text-slate-600">
            {t('inventory.table.actionMeta', {
              loggedBy: v.currentAction.loggedBy,
              loggedAt: format.dateTime(v.currentAction.loggedAt, v.timeZone),
            })}
          </span>
        </>
      ) : (
        t('inventory.table.noAction')
      ),
    ],
    [
      header('daysInStock'),
      <span key="days" className="inline-flex flex-wrap items-center gap-2">
        {t('vehicleActions.facts.days', {
          count: v.daysInStock,
          days: format.integer(v.daysInStock),
        })}
        {v.isAging && <AgingBadge />}
      </span>,
    ],
    [header('stockNumber'), v.stockNumber],
    [header('make'), v.make],
    [header('model'), v.model],
    [header('year'), v.modelYear],
    [header('trim'), v.trim],
    [header('colour'), v.colour],
    [header('listPrice'), format.money(v.listPriceMinor, v.currency)],
    [header('mileage'), format.mileage(v.mileage)],
    [header('stockInDate'), format.date(v.stockInDate)],
    [
      header('vin'),
      <span key="vin" className="font-mono text-xs">
        {v.vin}
      </span>,
    ],
  ];
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
      {facts.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-slate-600">{label}</dt>
          <dd className="text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
