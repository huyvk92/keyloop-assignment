import {
  AGING_THRESHOLD_DAYS,
  type AgeBucket,
  type SortKey,
  type SortOrder,
  type VehicleListItem,
  type VehicleListQuery,
} from '@shared/api/vehicles';

/**
 * In-memory equivalent of the API's filtering and sorting (server/src/modules/inventory), so
 * MSW-backed tests, Storybook and VITE_USE_MOCKS behave like the real endpoint.
 */

/** Inclusive bucket bounds (BR-07, TA-07), same table as the server's `vehicle-age.ts`. */
const BUCKET_AGES: Record<AgeBucket, { min: number; max?: number }> = {
  '0-30': { min: 0, max: 30 },
  '31-60': { min: 31, max: 60 },
  '61-90': { min: 61, max: 90 },
  'over-90': { min: AGING_THRESHOLD_DAYS + 1 },
};

/** Default order per sort key when `order` is omitted (TA-06). */
const DEFAULT_ORDER: Record<SortKey, SortOrder> = { age: 'desc', price: 'asc', makeModel: 'asc' };

/** Bucket, custom range and agingOnly intersect (BR-05, TA-07); empty means no rows. */
function ageBounds(query: VehicleListQuery): { min: number; max: number } {
  const mins = [0];
  const maxes = [Number.POSITIVE_INFINITY];
  if (query.ageBucket) {
    const bucket = BUCKET_AGES[query.ageBucket];
    mins.push(bucket.min);
    if (bucket.max !== undefined) maxes.push(bucket.max);
  }
  if (query.minAge !== undefined) mins.push(query.minAge);
  if (query.maxAge !== undefined) maxes.push(query.maxAge);
  if (query.agingOnly || query.needsAttention) mins.push(AGING_THRESHOLD_DAYS + 1);
  return { min: Math.max(...mins), max: Math.min(...maxes) };
}

/**
 * SQLite's case folding: ASCII letters only (LIKE and COLLATE NOCASE), so 'Ë' and 'ë' stay
 * distinct, unlike String#toLowerCase.
 */
export const foldAsciiCase = (text: string) => text.replace(/[A-Z]/g, (c) => c.toLowerCase());

function matches(vehicle: VehicleListItem, query: VehicleListQuery): boolean {
  const { min, max } = ageBounds(query);
  if (vehicle.daysInStock < min || vehicle.daysInStock > max) return false;
  // Exact match on facet values (TA-27).
  if (query.make !== undefined && vehicle.make !== query.make) return false;
  if (query.model !== undefined && vehicle.model !== query.model) return false;
  // Aging and no current action (BR-16).
  if (query.needsAttention && vehicle.currentAction !== null) return false;
  if (query.q !== undefined) {
    // Literal, ASCII case-insensitive substring of VIN, stock number or model (BR-08).
    const needle = foldAsciiCase(query.q);
    const haystacks = [vehicle.vin, vehicle.stockNumber, vehicle.model];
    if (!haystacks.some((text) => foldAsciiCase(text).includes(needle))) return false;
  }
  return true;
}

/** COLLATE NOCASE: ASCII-folded, then code-unit order (same as UTF-8 byte order in the BMP). */
const compareText = (a: string, b: string) => {
  const [x, y] = [foldAsciiCase(a), foldAsciiCase(b)];
  return x < y ? -1 : x > y ? 1 : 0;
};

/** Primary comparison in ascending order; `age` ascending = newest first. */
const ASCENDING: Record<SortKey, (a: VehicleListItem, b: VehicleListItem) => number> = {
  // Age follows stock_in_date like the server (a later date is a younger vehicle).
  age: (a, b) => compareText(b.stockInDate, a.stockInDate),
  price: (a, b) => a.listPriceMinor - b.listPriceMinor,
  makeModel: (a, b) => compareText(a.make, b.make) || compareText(a.model, b.model),
};

/** Stable total order: stock number then id, always ascending (BR-17, TA-06). */
const tieBreak = (a: VehicleListItem, b: VehicleListItem) =>
  (a.stockNumber < b.stockNumber ? -1 : a.stockNumber > b.stockNumber ? 1 : 0) || a.id - b.id;

export function queryVehicles(
  vehicles: VehicleListItem[],
  query: VehicleListQuery,
): VehicleListItem[] {
  const direction = (query.order ?? DEFAULT_ORDER[query.sort]) === 'asc' ? 1 : -1;
  const primary = ASCENDING[query.sort];
  return vehicles
    .filter((vehicle) => matches(vehicle, query))
    .sort((a, b) => direction * primary(a, b) || tieBreak(a, b));
}
