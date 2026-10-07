/**
 * Display formatting (NFR-08, TA-26). Every function takes a locale, `en-GB` by default:
 * - en-GB: "£25,990", "07 Oct 2026", "07 Oct 2026, 14:32", "12,345 mi" (fixed month table).
 * - vi-VN: "25.990 £", "07/10/2026", "07/10/2026 14:32", "12.345 mi" (Intl vi-VN separators;
 *   the currency stays the dealership's, the mileage unit stays "mi").
 * Date-only values are formatted in UTC so they never shift a day in the runner's time zone.
 */
export type Locale = 'en-GB' | 'vi-VN';

/** Digits and calendar fields are read with en-GB (Latin digits); only the layout is per-locale. */
const PARTS_LOCALE = 'en-GB';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const moneyFormatters = new Map<string, Intl.NumberFormat>();

function moneyFormatter(
  currency: string,
  fractionDigits: number,
  locale: Locale,
): Intl.NumberFormat {
  const key = `${locale}:${currency}:${fractionDigits}`;
  let formatter = moneyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    moneyFormatters.set(key, formatter);
  }
  return formatter;
}

/** Number of minor-unit digits for a currency (GBP 2, JPY 0), per ISO 4217 data in Intl. */
const minorUnitDigitsCache = new Map<string, number>();

function minorUnitDigits(currency: string): number {
  let digits = minorUnitDigitsCache.get(currency);
  if (digits === undefined) {
    digits =
      new Intl.NumberFormat(PARTS_LOCALE, { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    minorUnitDigitsCache.set(currency, digits);
  }
  return digits;
}

/**
 * Format an integer amount in minor units (ADR-005, TA-03).
 * Whole amounts drop the decimals: `formatMoney(2599000, 'GBP')` gives "£25,990",
 * `formatMoney(2599050, 'GBP')` gives "£25,990.50". In vi-VN: "25.990 £" (no-break space).
 */
export function formatMoney(
  amountMinor: number,
  currency: string,
  locale: Locale = 'en-GB',
): string {
  const digits = minorUnitDigits(currency);
  const factor = 10 ** digits;
  const isWhole = amountMinor % factor === 0;
  return moneyFormatter(currency, isWhole ? 0 : digits, locale).format(amountMinor / factor);
}

const dateParts = new Intl.DateTimeFormat(PARTS_LOCALE, {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/**
 * Fixed 3-letter month names. ICU data differs between runtimes (Chrome's en-GB gives "Sept",
 * Node may give "Sep"), so the month name is not taken from Intl (NFR-08: "07 Oct 2026").
 */
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? '';
}

function joinDate(parts: Intl.DateTimeFormatPart[], locale: Locale): string {
  if (locale === 'vi-VN') {
    return `${part(parts, 'day')}/${part(parts, 'month')}/${part(parts, 'year')}`;
  }
  const month = MONTHS[Number(part(parts, 'month')) - 1];
  return `${part(parts, 'day')} ${month ?? part(parts, 'month')} ${part(parts, 'year')}`;
}

/**
 * Format a date-only string (`YYYY-MM-DD`) as "01 Jun 2026" (vi-VN: "01/06/2026").
 * Throws RangeError if invalid.
 */
export function formatDate(isoDate: string, locale: Locale = 'en-GB'): string {
  const match = DATE_ONLY.exec(isoDate);
  if (!match) throw new RangeError(`Invalid date: ${isoDate}`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError(`Invalid date: ${isoDate}`);
  }
  return joinDate(dateParts.formatToParts(date), locale);
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function dateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dateTimeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(PARTS_LOCALE, {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    dateTimeFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Format an ISO-8601 instant in an IANA time zone as "07 Oct 2026, 14:32" (TA-12);
 * vi-VN: "07/10/2026 14:32". Throws RangeError for an invalid timestamp or time zone.
 */
export function formatDateTime(
  isoInstant: string,
  timeZone: string,
  locale: Locale = 'en-GB',
): string {
  const date = new Date(isoInstant);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid timestamp: ${isoInstant}`);
  const parts = dateTimeFormatter(timeZone).formatToParts(date);
  const separator = locale === 'vi-VN' ? ' ' : ', ';
  return `${joinDate(parts, locale)}${separator}${part(parts, 'hour')}:${part(parts, 'minute')}`;
}

const integerFormatters = new Map<Locale, Intl.NumberFormat>();

/** Format a whole number with the locale's grouping: "1,200" (en-GB), "1.200" (vi-VN). */
export function formatInteger(value: number, locale: Locale = 'en-GB'): string {
  let formatter = integerFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    integerFormatters.set(locale, formatter);
  }
  return formatter.format(value);
}

/** Format a mileage in miles as "12,345 mi" (TA-04); vi-VN: "12.345 mi". */
export function formatMileage(miles: number, locale: Locale = 'en-GB'): string {
  return `${formatInteger(miles, locale)} mi`;
}
