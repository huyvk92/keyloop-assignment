import { AGING_THRESHOLD_DAYS, type AgeBucket } from '@shared/api/vehicles';
import { addDays, daysBetween } from '../../lib/dates';

/**
 * Vehicle age rules (BR-01..BR-03). `today` is always the dealership-local date
 * (`localDate(clock.now(), timeZone)`); nothing here reads the clock or stores a result.
 */

/** Whole days in stock, never negative (BR-01). */
export function ageInDays(stockInDate: string, today: string): number {
  return Math.max(0, daysBetween(stockInDate, today));
}

/** Strictly more than 90 days (BR-02): 90 is not aging, 91 is. */
export function isAging(age: number): boolean {
  return age > AGING_THRESHOLD_DAYS;
}

/** Youngest aging age: 91 days (BR-02). */
const AGING_MIN_AGE = AGING_THRESHOLD_DAYS + 1;

/** Latest stock-in date that counts as aging: `stock_in_date <= cutoff` (age >= 91). */
export function agingCutoffDate(today: string): string {
  return addDays(today, -AGING_MIN_AGE);
}

/** Inclusive age bounds per bucket (BR-07, TA-07); `max` undefined = open-ended. */
const BUCKET_AGES: Record<AgeBucket, { min: number; max?: number }> = {
  '0-30': { min: 0, max: 30 },
  '31-60': { min: 31, max: 60 },
  '61-90': { min: 61, max: 90 },
  'over-90': { min: AGING_MIN_AGE },
};

export type AgeFilter = {
  ageBucket?: AgeBucket | undefined;
  minAge?: number | undefined;
  maxAge?: number | undefined;
  agingOnly?: boolean | undefined;
};

/** Inclusive `stock_in_date` bounds (`from <= stock_in_date <= to`); a missing side is open. */
export type StockInDateRange = { from?: string; to?: string };

/**
 * Turns the age filters into `stock_in_date` bounds so SQL never computes "now" (ADR-002, §4.3).
 * Bucket, custom range and agingOnly intersect (BR-05, TA-07); an empty intersection returns
 * `null`, meaning "no rows" rather than an error. `age >= n` becomes `stock_in_date <= today - n`
 * and `age <= n` becomes `stock_in_date >= today - n`. A lower age bound of 0 adds no upper date
 * bound, so future-dated rows (age clamped to 0, BR-01) still match (TA-22).
 */
export function ageFilterToDateRange(
  { ageBucket, minAge, maxAge, agingOnly }: AgeFilter,
  today: string,
): StockInDateRange | null {
  const mins = [0];
  const maxes: number[] = [];
  if (ageBucket) {
    const bucket = BUCKET_AGES[ageBucket];
    mins.push(bucket.min);
    if (bucket.max !== undefined) maxes.push(bucket.max);
  }
  if (minAge !== undefined) mins.push(minAge);
  if (maxAge !== undefined) maxes.push(maxAge);
  if (agingOnly) mins.push(AGING_MIN_AGE);

  const lowest = Math.max(...mins);
  const highest = maxes.length > 0 ? Math.min(...maxes) : undefined;
  if (highest !== undefined && lowest > highest) return null;

  const range: StockInDateRange = {};
  if (highest !== undefined) range.from = addDays(today, -highest);
  if (lowest > 0) range.to = addDays(today, -lowest);
  return range;
}
