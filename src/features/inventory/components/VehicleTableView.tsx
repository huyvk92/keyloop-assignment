import type { Dealership } from '@shared/api/dealerships';
import type { VehicleListItem } from '@shared/api/vehicles';
import type { TFunction } from 'i18next';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { en } from '@/i18n/resources/en';
import { cn } from '@/lib/cn';
import { useFormatters, type Formatters } from '@/lib/use-formatters';
import { Button } from '@/components/Button';
import { AgingBadge } from './AgingBadge';

type Props = {
  vehicles: VehicleListItem[];
  /** Supplies the currency for prices and the time zone for action timestamps. */
  dealership: Dealership;
  /** Adds a leading "View <stock number>" button per row that opens the vehicle (T-030). */
  onSelectVehicle?: (vehicleId: number) => void;
};

const cell = 'px-3 py-2 whitespace-nowrap';
const numeric = 'text-right tabular-nums';

type ColumnId = keyof typeof en.inventory.table.header;

type RenderContext = { dealership: Dealership; t: TFunction; format: Formatters };

type Column = {
  /** Also the header's translation key: `inventory.table.header.<id>`. */
  id: ColumnId;
  className?: string;
  render: (vehicle: VehicleListItem, context: RenderContext) => ReactNode;
};

/**
 * Column order puts what a manager acts on first (age, aging flag, current action) so it stays
 * visible without horizontal scrolling at 1280 px (PRD G-03 "prominently"); reference
 * identifiers (trim, colour, VIN) come last. All AC-001.1 fields are present.
 * Vehicle data (make, model, trim, colour, logged-by) is shown as stored, never translated;
 * only the action status label is (BR-19).
 */
const columns: Column[] = [
  { id: 'stockNumber', className: 'font-medium', render: (v) => v.stockNumber },
  { id: 'make', render: (v) => v.make },
  { id: 'model', render: (v) => v.model },
  { id: 'year', render: (v) => v.modelYear },
  { id: 'daysInStock', className: numeric, render: (v) => v.daysInStock },
  {
    id: 'aging',
    render: (v, { t }) =>
      v.isAging ? (
        <AgingBadge />
      ) : (
        <>
          <span aria-hidden="true" className="text-slate-400">
            —
          </span>
          <span className="sr-only">{t('inventory.table.notAging')}</span>
        </>
      ),
  },
  {
    id: 'currentAction',
    render: (v, { dealership, t, format }) =>
      v.currentAction ? (
        <>
          <span className="block font-medium">{t(`actionStatus.${v.currentAction.status}`)}</span>
          <span className="block text-xs text-slate-600">
            {t('inventory.table.actionMeta', {
              loggedBy: v.currentAction.loggedBy,
              loggedAt: format.dateTime(v.currentAction.loggedAt, dealership.timeZone),
            })}
          </span>
        </>
      ) : (
        <span className="text-slate-600">{t('inventory.table.noAction')}</span>
      ),
  },
  {
    id: 'listPrice',
    className: numeric,
    render: (v, { dealership, format }) => format.money(v.listPriceMinor, dealership.currency),
  },
  { id: 'stockInDate', render: (v, { format }) => format.date(v.stockInDate) },
  { id: 'mileage', className: numeric, render: (v, { format }) => format.mileage(v.mileage) },
  { id: 'trim', render: (v) => v.trim },
  { id: 'colour', render: (v) => v.colour },
  { id: 'vin', className: 'font-mono text-xs', render: (v) => v.vin },
];

/** The "View" column: a real button per row (rows themselves aren't clickable, TRD section 6). */
const viewColumn = (onSelectVehicle: (vehicleId: number) => void): Column => ({
  id: 'details',
  render: (v, { t }) => (
    <Button
      variant="secondary"
      size="sm"
      aria-label={t('inventory.table.viewLabel', { stockNumber: v.stockNumber })}
      onClick={() => onSelectVehicle(v.id)}
    >
      {t('inventory.table.view')}
    </Button>
  ),
});

/**
 * Presentational inventory table: one row per vehicle, 13 data columns (AC-001.1), plus a leading
 * "View" column when rows can be opened.
 */
export function VehicleTableView({ vehicles, dealership, onSelectVehicle }: Props) {
  const captionId = useId();
  const { t } = useTranslation();
  const format = useFormatters();
  const context: RenderContext = { dealership, t, format };
  const shown = onSelectVehicle ? [viewColumn(onSelectVehicle), ...columns] : columns;
  return (
    // Focusable, labelled scroll container so keyboard users can scroll the table (NFR-07).
    <div
      role="region"
      aria-labelledby={captionId}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be keyboard-focusable (WCAG 2.1.1)
      tabIndex={0}
      className="overflow-x-auto rounded-lg border border-slate-200 bg-white focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
    >
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <caption id={captionId} className="sr-only">
          {t('inventory.table.caption', { dealership: dealership.name })}
        </caption>
        <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-700 uppercase">
          <tr>
            {shown.map((column) => (
              <th key={column.id} scope="col" className={cn(cell, column.className)}>
                {t(`inventory.table.header.${column.id}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {vehicles.map((v) => (
            <tr key={v.id} className="hover:bg-slate-50">
              {shown.map((column) => (
                <td key={column.id} className={cn(cell, column.className)}>
                  {column.render(v, context)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
