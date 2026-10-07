/**
 * Source of the current time. Business rules must read time through a Clock (never `new Date()`
 * directly) so tests and demos can pin "today".
 */
export type Clock = { now: () => Date };

export const systemClock: Clock = { now: () => new Date() };

/** A clock frozen at noon UTC on the given date (YYYY-MM-DD). */
export function fixedClock(isoDate: string): Clock {
  const instant = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(instant.getTime())) throw new Error(`Invalid date: ${isoDate}`);
  return { now: () => new Date(instant) };
}
