import type { Dealership } from '@shared/api/dealerships';
import type { SortKey, SortOrder, VehicleListItem } from '@shared/api/vehicles';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useFormatters } from '@/lib/use-formatters';
import { SortableHeader } from './SortableHeader';
import { columns, viewColumn, type RenderContext } from './vehicle-columns';

/** The list's sort and how to change it; without it no header is a button. */
export type Sorting = { sort: SortKey; order: SortOrder; onSort: (key: SortKey) => void };

type Props = {
  vehicles: VehicleListItem[];
  /** Supplies the currency for prices and the time zone for action timestamps. */
  dealership: Dealership;
  /** Adds a leading "View <stock number>" button per row that opens the vehicle (T-030). */
  onSelectVehicle?: (vehicleId: number) => void;
  /** Makes the Days in stock, Make (make, then model) and List price headers sortable (US-011). */
  sorting?: Sorting;
};

const cell = 'px-3 py-2 whitespace-nowrap';
/**
 * Presentational inventory table: one row per vehicle, 13 data columns (AC-001.1), plus a leading
 * "View" column when rows can be opened.
 */
export function VehicleTableView({ vehicles, dealership, onSelectVehicle, sorting }: Props) {
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
            {shown.map((column) =>
              column.sortKey && sorting ? (
                <SortableHeader
                  key={column.id}
                  label={t(`inventory.table.header.${column.id}`)}
                  sortKey={column.sortKey}
                  hint={
                    column.sortKey === 'makeModel' ? t('inventory.sort.hints.makeModel') : undefined
                  }
                  {...sorting}
                  className={cn(cell, column.className)}
                />
              ) : (
                <th key={column.id} scope="col" className={cn(cell, column.className)}>
                  {t(`inventory.table.header.${column.id}`)}
                </th>
              ),
            )}
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
