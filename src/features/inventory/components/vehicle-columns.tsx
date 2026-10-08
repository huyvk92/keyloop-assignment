import type { Dealership } from '@shared/api/dealerships';
import type { SortKey, VehicleListItem } from '@shared/api/vehicles';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { Button } from '@/components/Button';
import type { en } from '@/i18n/resources/en';
import type { Formatters } from '@/lib/use-formatters';
import { AgingBadge } from './AgingBadge';
import { AttentionBadge } from './AttentionBadge';

/** Column definitions of `VehicleTableView` (data only, no component). */
const numeric = 'text-right tabular-nums';

type ColumnId = keyof typeof en.inventory.table.header;

export type RenderContext = { dealership: Dealership; t: TFunction; format: Formatters };

export type Column = {
  /** Also the header's translation key: `inventory.table.header.<id>`. */
  id: ColumnId;
  /** The API sort key behind this column's header button (TA-06). */
  sortKey?: SortKey;
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
export const columns: Column[] = [
  { id: 'stockNumber', className: 'font-medium', render: (v) => v.stockNumber },
  // Sorts by make, then model (AC-011.2); the Model column follows it.
  { id: 'make', sortKey: 'makeModel', render: (v) => v.make },
  { id: 'model', render: (v) => v.model },
  { id: 'year', render: (v) => v.modelYear },
  { id: 'daysInStock', sortKey: 'age', className: numeric, render: (v) => v.daysInStock },
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
        <>
          <span className="block text-slate-600">{t('inventory.table.noAction')}</span>
          {/* Aging + "No action" (BR-16): a text label under it, so the column doesn't widen. */}
          {v.needsAttention && <AttentionBadge className="mt-0.5" />}
        </>
      ),
  },
  {
    id: 'listPrice',
    sortKey: 'price',
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
export const viewColumn = (onSelectVehicle: (vehicleId: number) => void): Column => ({
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
