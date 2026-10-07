import type { Dealership } from '@shared/api/dealerships';
import type { VehicleListItem } from '@shared/api/vehicles';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatMileage, formatMoney } from '@/lib/format';
import { AgingBadge } from './AgingBadge';

type Props = {
  vehicles: VehicleListItem[];
  /** Supplies the currency for prices and the time zone for action timestamps. */
  dealership: Dealership;
};

const cell = 'px-3 py-2 whitespace-nowrap';
const numeric = 'text-right tabular-nums';

type Column = {
  header: string;
  className?: string;
  render: (vehicle: VehicleListItem, dealership: Dealership) => ReactNode;
};

/**
 * Column order puts what a manager acts on first (age, aging flag, current action) so it stays
 * visible without horizontal scrolling at 1280 px (PRD G-03 "prominently"); reference
 * identifiers (trim, colour, VIN) come last. All AC-001.1 fields are present.
 */
const columns: Column[] = [
  { header: 'Stock no.', className: 'font-medium', render: (v) => v.stockNumber },
  { header: 'Make', render: (v) => v.make },
  { header: 'Model', render: (v) => v.model },
  { header: 'Year', render: (v) => v.modelYear },
  { header: 'Days in stock', className: numeric, render: (v) => v.daysInStock },
  {
    header: 'Aging',
    render: (v) =>
      v.isAging ? (
        <AgingBadge />
      ) : (
        <>
          <span aria-hidden="true" className="text-slate-400">
            —
          </span>
          <span className="sr-only">Not aging</span>
        </>
      ),
  },
  {
    header: 'Current action',
    render: (v, dealership) =>
      v.currentAction ? (
        <>
          <span className="block font-medium">{v.currentAction.status}</span>
          <span className="block text-xs text-slate-600">
            {`${v.currentAction.loggedBy} · ${formatDateTime(v.currentAction.loggedAt, dealership.timeZone)}`}
          </span>
        </>
      ) : (
        <span className="text-slate-600">No action</span>
      ),
  },
  {
    header: 'List price',
    className: numeric,
    render: (v, dealership) => formatMoney(v.listPriceMinor, dealership.currency),
  },
  { header: 'Stock-in date', render: (v) => formatDate(v.stockInDate) },
  { header: 'Mileage', className: numeric, render: (v) => formatMileage(v.mileage) },
  { header: 'Trim', render: (v) => v.trim },
  { header: 'Colour', render: (v) => v.colour },
  { header: 'VIN', className: 'font-mono text-xs', render: (v) => v.vin },
];

/** Presentational inventory table: one row per vehicle, 13 columns (AC-001.1). */
export function VehicleTableView({ vehicles, dealership }: Props) {
  const captionId = useId();
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
          {`Vehicles in stock at ${dealership.name}`}
        </caption>
        <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-700 uppercase">
          <tr>
            {columns.map((column) => (
              <th key={column.header} scope="col" className={cn(cell, column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {vehicles.map((v) => (
            <tr key={v.id} className="hover:bg-slate-50">
              {columns.map((column) => (
                <td key={column.header} className={cn(cell, column.className)}>
                  {column.render(v, dealership)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
