import { AGING_THRESHOLD_DAYS } from '@shared/api/vehicles';
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

/** Latest stock-in date that counts as aging: `stock_in_date <= cutoff` (age >= 91). */
export function agingCutoffDate(today: string): string {
  return addDays(today, -(AGING_THRESHOLD_DAYS + 1));
}
