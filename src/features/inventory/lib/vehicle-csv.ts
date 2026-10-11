import type { Dealership } from '@shared/api/dealerships';
import type { VehicleListItem } from '@shared/api/vehicles';
import type { TFunction } from 'i18next';
import { toMajorUnits } from '@/lib/format';
import { toCsv, type CsvCell } from './csv';

type Column = {
  header: (t: TFunction) => string;
  cell: (vehicle: VehicleListItem, context: { t: TFunction; currency: string }) => CsvCell;
};

const yesNo = (value: boolean, t: TFunction) =>
  value ? t('inventory.export.yes') : t('inventory.export.no');

/**
 * The export's columns, in file order (TA-34). Headings and the Yes/No and action-status labels
 * follow the UI language; vehicle data is written exactly as stored (BR-19). Dates stay ISO
 * (`YYYY-MM-DD`), `loggedAt` stays the API's ISO UTC instant, the price is a plain decimal in
 * major units with the currency in its own column (A-17), and mileage is whole miles.
 */
const COLUMNS: readonly Column[] = [
  { header: (t) => t('inventory.export.columns.stockNumber'), cell: (v) => v.stockNumber },
  { header: (t) => t('inventory.export.columns.vin'), cell: (v) => v.vin },
  { header: (t) => t('inventory.export.columns.make'), cell: (v) => v.make },
  { header: (t) => t('inventory.export.columns.model'), cell: (v) => v.model },
  { header: (t) => t('inventory.export.columns.year'), cell: (v) => v.modelYear },
  { header: (t) => t('inventory.export.columns.trim'), cell: (v) => v.trim },
  { header: (t) => t('inventory.export.columns.colour'), cell: (v) => v.colour },
  { header: (t) => t('inventory.export.columns.mileage'), cell: (v) => v.mileage },
  {
    header: (t) => t('inventory.export.columns.listPrice'),
    // A numeric cell: our own digits, never guarded or quoted (lib/csv.ts).
    cell: (v, { currency }) => ({ numeric: toMajorUnits(v.listPriceMinor, currency) }),
  },
  { header: (t) => t('inventory.export.columns.currency'), cell: (_, { currency }) => currency },
  { header: (t) => t('inventory.export.columns.stockInDate'), cell: (v) => v.stockInDate },
  { header: (t) => t('inventory.export.columns.daysInStock'), cell: (v) => v.daysInStock },
  { header: (t) => t('inventory.export.columns.aging'), cell: (v, { t }) => yesNo(v.isAging, t) },
  {
    header: (t) => t('inventory.export.columns.needsAttention'),
    cell: (v, { t }) => yesNo(v.needsAttention, t),
  },
  {
    header: (t) => t('inventory.export.columns.currentAction'),
    cell: (v, { t }) =>
      v.currentAction ? t(`actionStatus.${v.currentAction.status}`) : t('inventory.table.noAction'),
  },
  {
    header: (t) => t('inventory.export.columns.loggedBy'),
    cell: (v) => v.currentAction?.loggedBy ?? null,
  },
  {
    header: (t) => t('inventory.export.columns.loggedAt'),
    cell: (v) => v.currentAction?.loggedAt ?? null,
  },
];

/** The CSV text (with BOM) for the vehicles, in the given order, headings in `t`'s language. */
export function vehiclesToCsv(
  vehicles: readonly VehicleListItem[],
  { t, currency }: { t: TFunction; currency: string },
): string {
  const header = COLUMNS.map((column) => column.header(t));
  const rows = vehicles.map((vehicle) =>
    COLUMNS.map((column) => column.cell(vehicle, { t, currency })),
  );
  return toCsv([header, ...rows]);
}

/**
 * ASCII file-name slug of a dealership name: accents removed (Vietnamese "đ" becomes "d"),
 * lower case, runs of other characters become one "-". "Birmingham Central Motors" gives
 * "birmingham-central-motors".
 */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll('đ', 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "Today" (`YYYY-MM-DD`) in an IANA time zone, e.g. the dealership's (TA-01). */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * `inventory-<dealership slug>-<YYYY-MM-DD>.csv` (TA-34). `localDate` is the dealership-local
 * date; a name with no ASCII letters or digits falls back to `dealership-<id>`.
 */
export function exportFileName(dealership: Pick<Dealership, 'id' | 'name'>, localDate: string) {
  const slug = slugify(dealership.name) || `dealership-${dealership.id}`;
  return `inventory-${slug}-${localDate}.csv`;
}
