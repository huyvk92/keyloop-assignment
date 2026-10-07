import { formatDate, formatDateTime, formatMileage, formatMoney } from '@/lib/format';

describe('formatMoney', () => {
  it('shows whole amounts without decimals (AC-001.7)', () => {
    expect(formatMoney(2599000, 'GBP')).toBe('£25,990');
  });

  it('shows minor units when the amount is not whole', () => {
    expect(formatMoney(2599050, 'GBP')).toBe('£25,990.50');
  });

  it('uses the currency of the dealership without conversion', () => {
    expect(formatMoney(1250000, 'EUR')).toBe('€12,500');
  });

  it('handles currencies without minor units', () => {
    expect(formatMoney(2599000, 'JPY')).toBe('JP¥2,599,000');
  });

  it('formats zero', () => {
    expect(formatMoney(0, 'GBP')).toBe('£0');
  });
});

describe('formatDate', () => {
  it('formats a date-only string unambiguously (AC-001.7)', () => {
    expect(formatDate('2026-06-01')).toBe('01 Jun 2026');
  });

  it('never shifts the day, whatever the runner time zone', () => {
    // First and last day of a month/year are where a TZ shift would show up.
    expect(formatDate('2026-01-01')).toBe('01 Jan 2026');
    expect(formatDate('2025-12-31')).toBe('31 Dec 2025');
    expect(formatDate('2024-02-29')).toBe('29 Feb 2024');
  });

  it('rejects strings that are not a calendar date', () => {
    expect(() => formatDate('01/06/2026')).toThrow(RangeError);
    expect(() => formatDate('2026-02-30')).toThrow(RangeError);
  });
});

describe('formatDateTime', () => {
  it('includes the date and 24-hour time in the given time zone (TA-12)', () => {
    // 13:32 UTC is 14:32 BST
    expect(formatDateTime('2026-10-07T13:32:00.000Z', 'Europe/London')).toBe('07 Oct 2026, 14:32');
  });

  it('converts across the day boundary for the target time zone', () => {
    expect(formatDateTime('2026-12-31T23:30:00.000Z', 'Europe/Paris')).toBe('01 Jan 2027, 00:30');
    expect(formatDateTime('2026-01-01T00:05:00.000Z', 'Europe/London')).toBe('01 Jan 2026, 00:05');
  });

  it('rejects an invalid timestamp', () => {
    expect(() => formatDateTime('not-a-date', 'Europe/London')).toThrow(RangeError);
  });
});

describe('formatMileage', () => {
  it('formats miles with thousands separators (TA-04)', () => {
    expect(formatMileage(12345)).toBe('12,345 mi');
  });

  it('formats zero and large values', () => {
    expect(formatMileage(0)).toBe('0 mi');
    expect(formatMileage(1234567)).toBe('1,234,567 mi');
  });
});

describe('month names', () => {
  it('always uses 3-letter months, including September (Chrome en-GB would print "Sept")', () => {
    expect(formatDate('2025-09-02')).toBe('02 Sep 2025');
    expect(formatDateTime('2025-09-02T08:30:00.000Z', 'Europe/London')).toBe('02 Sep 2025, 09:30');
    expect(
      ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) =>
        formatDate(`2026-${m}-15`).slice(3, 6),
      ),
    ).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
  });
});
