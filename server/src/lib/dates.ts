/**
 * Calendar-date helpers on `YYYY-MM-DD` strings (ADR-002). Pure and framework-free: no clock,
 * no system time. Arithmetic runs on UTC-midnight epoch days, so DST changes can't shift a day.
 */
const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    // Throws RangeError for an unknown IANA zone
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Epoch day number of a strict `YYYY-MM-DD` date; throws for malformed or impossible dates. */
function toEpochDay(date: string): number {
  const ms = ISO_DATE.test(date) ? Date.parse(`${date}T00:00:00.000Z`) : Number.NaN;
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid date: ${date}`);
  }
  return ms / MS_PER_DAY;
}

function fromEpochDay(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** True for a real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(value: string): boolean {
  try {
    toEpochDay(value);
    return true;
  } catch {
    return false;
  }
}

/** The calendar date (`YYYY-MM-DD`) of `instant` as seen in the IANA `timeZone`. */
export function localDate(instant: Date, timeZone: string): string {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return toEpochDay(to) - toEpochDay(from);
}

/** `date` moved by `days` calendar days (negative to go back). */
export function addDays(date: string, days: number): string {
  return fromEpochDay(toEpochDay(date) + days);
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** UTC offset of `timeZone` at `instant`, in minutes (e.g. +60 for BST). */
function offsetMinutes(instant: Date, timeZone: string): number {
  let formatter = offsetFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' });
    offsetFormatters.set(timeZone, formatter);
  }
  const name = formatter.formatToParts(instant).find((p) => p.type === 'timeZoneName')?.value;
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(name ?? '');
  if (!match) return 0; // plain "GMT" = UTC+0
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}

/**
 * The UTC instant of wall-clock `time` (`HH:MM`) on `date` in `timeZone`. A time inside a
 * spring-forward gap resolves to the instant using the pre-change offset.
 */
export function zonedTimeToInstant(date: string, time: string, timeZone: string): Date {
  if (!HH_MM.test(time)) throw new Error(`Invalid time: ${time}`);
  const naive = toEpochDay(date) * MS_PER_DAY + Date.parse(`1970-01-01T${time}:00.000Z`);
  const guess = naive - offsetMinutes(new Date(naive), timeZone) * 60_000;
  return new Date(naive - offsetMinutes(new Date(guess), timeZone) * 60_000);
}
