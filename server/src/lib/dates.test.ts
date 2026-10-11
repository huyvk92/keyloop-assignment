import { addDays, daysBetween, isIsoDate, localDate, zonedTimeToInstant } from './dates';

describe('localDate (TA-01, ADR-002)', () => {
  it('returns the calendar date in the given time zone, not UTC', () => {
    // 23:30 UTC on 7 Oct is 00:30 BST on 8 Oct in London (AC-003.5)
    const lateEvening = new Date('2026-10-07T23:30:00Z');
    expect(localDate(lateEvening, 'Europe/London')).toBe('2026-10-08');
    expect(localDate(lateEvening, 'UTC')).toBe('2026-10-07');
    expect(localDate(lateEvening, 'America/New_York')).toBe('2026-10-07');
  });

  it('follows the London offset on both sides of the DST changes', () => {
    // Before 01:00 UTC on 29 Mar London is still on GMT
    expect(localDate(new Date('2026-03-28T23:30:00Z'), 'Europe/London')).toBe('2026-03-28');
    expect(localDate(new Date('2026-03-29T23:30:00Z'), 'Europe/London')).toBe('2026-03-30');
    // 24 Oct is still BST, 25 Oct 23:30 UTC is GMT again
    expect(localDate(new Date('2026-10-24T23:30:00Z'), 'Europe/London')).toBe('2026-10-25');
    expect(localDate(new Date('2026-10-25T23:30:00Z'), 'Europe/London')).toBe('2026-10-25');
  });

  it('throws on an unknown time zone', () => {
    expect(() => localDate(new Date('2026-10-07T12:00:00Z'), 'Mars/Olympus')).toThrow(RangeError);
  });
});

describe('daysBetween', () => {
  it('counts whole calendar days, signed', () => {
    expect(daysBetween('2026-10-07', '2026-10-07')).toBe(0);
    expect(daysBetween('2026-07-09', '2026-10-07')).toBe(90);
    expect(daysBetween('2026-07-08', '2026-10-07')).toBe(91);
    expect(daysBetween('2026-10-08', '2026-10-07')).toBe(-1);
  });

  it('is not affected by DST changes (2026-03-29, 2026-10-25)', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364);
  });

  it('handles the leap day', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2028-02-29', '2029-02-28')).toBe(365);
  });

  it('rejects malformed or impossible dates', () => {
    expect(() => daysBetween('2026-13-01', '2026-10-07')).toThrow(/Invalid date/);
    expect(() => daysBetween('2026-02-30', '2026-10-07')).toThrow(/Invalid date/);
    expect(() => daysBetween('7 Oct 2026', '2026-10-07')).toThrow(/Invalid date/);
  });
});

describe('addDays', () => {
  it('moves across month, year and leap-day boundaries', () => {
    expect(addDays('2026-10-07', -90)).toBe('2026-07-09');
    expect(addDays('2026-10-07', -91)).toBe('2026-07-08');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });
});

describe('isIsoDate', () => {
  it('accepts only real YYYY-MM-DD dates', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-1-01')).toBe(false);
  });
});

describe('zonedTimeToInstant', () => {
  it('converts a local wall-clock time to the UTC instant, honouring DST', () => {
    expect(zonedTimeToInstant('2026-10-05', '09:00', 'Europe/London').toISOString()).toBe(
      '2026-10-05T08:00:00.000Z',
    );
    expect(zonedTimeToInstant('2026-12-01', '09:00', 'Europe/London').toISOString()).toBe(
      '2026-12-01T09:00:00.000Z',
    );
    expect(zonedTimeToInstant('2026-10-05', '09:00', 'America/New_York').toISOString()).toBe(
      '2026-10-05T13:00:00.000Z',
    );
    expect(zonedTimeToInstant('2026-10-05', '09:00', 'UTC').toISOString()).toBe(
      '2026-10-05T09:00:00.000Z',
    );
  });

  it('round-trips through localDate', () => {
    const instant = zonedTimeToInstant('2026-10-25', '00:30', 'Europe/London');
    expect(localDate(instant, 'Europe/London')).toBe('2026-10-25');
  });

  it('moves a time skipped by the spring-forward gap to a real instant', () => {
    // 01:30 does not exist in London on 2026-03-29 (01:00 GMT -> 02:00 BST)
    const instant = zonedTimeToInstant('2026-03-29', '01:30', 'Europe/London');
    expect(instant.toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });

  it('rejects a malformed time', () => {
    expect(() => zonedTimeToInstant('2026-10-05', '9am', 'Europe/London')).toThrow(/Invalid time/);
  });
});
