import {
  formatDate,
  formatDateTime,
  formatInteger,
  formatMileage,
  formatMoney,
  formatPercent,
} from '@/lib/format';

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

describe('explicit en-GB locale', () => {
  it('gives exactly the default (English) output', () => {
    expect(formatMoney(2599000, 'GBP', 'en-GB')).toBe('£25,990');
    expect(formatDate('2026-10-07', 'en-GB')).toBe('07 Oct 2026');
    expect(formatDateTime('2026-10-07T13:32:00.000Z', 'Europe/London', 'en-GB')).toBe(
      '07 Oct 2026, 14:32',
    );
    expect(formatMileage(12345, 'en-GB')).toBe('12,345 mi');
    expect(formatInteger(1200)).toBe('1,200');
  });
});

describe('vi-VN locale (AC-015.4, TA-26)', () => {
  // Intl vi-VN puts a no-break space (U+00A0) between the amount and the currency symbol.
  const NBSP = '\u00a0';

  it('formats dates as dd/mm/yyyy', () => {
    expect(formatDate('2026-10-07', 'vi-VN')).toBe('07/10/2026');
    expect(formatDate('2025-12-31', 'vi-VN')).toBe('31/12/2025');
    expect(() => formatDate('2026-02-30', 'vi-VN')).toThrow(RangeError);
  });

  it('formats timestamps as dd/mm/yyyy HH:mm, 24-hour, in the dealership time zone', () => {
    expect(formatDateTime('2026-10-07T13:32:00.000Z', 'Europe/London', 'vi-VN')).toBe(
      '07/10/2026 14:32',
    );
    expect(formatDateTime('2026-12-31T23:30:00.000Z', 'Europe/Paris', 'vi-VN')).toBe(
      '01/01/2027 00:30',
    );
  });

  it('formats money with Vietnamese separators, keeping the dealership currency', () => {
    expect(formatMoney(2599000, 'GBP', 'vi-VN')).toBe(`25.990${NBSP}£`);
    expect(formatMoney(2599050, 'GBP', 'vi-VN')).toBe(`25.990,50${NBSP}£`);
    expect(formatMoney(1250000, 'EUR', 'vi-VN')).toBe(`12.500${NBSP}€`);
  });

  it('formats mileage and counts with Vietnamese grouping, unit stays "mi"', () => {
    expect(formatMileage(12345, 'vi-VN')).toBe('12.345 mi');
    expect(formatInteger(1200, 'vi-VN')).toBe('1.200');
  });

  it('does not change the English output once Vietnamese has been used (no shared cache)', () => {
    formatMoney(2599000, 'GBP', 'vi-VN');
    expect(formatMoney(2599000, 'GBP')).toBe('£25,990');
    expect(formatMileage(12345)).toBe('12,345 mi');
  });
});

describe('formatPercent (BR-15, TA-21)', () => {
  it('shows up to one decimal place with the sign appended (AC-005.1, AC-005.3)', () => {
    expect(formatPercent(37.5)).toBe('37.5%');
    expect(formatPercent(66.7)).toBe('66.7%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(100)).toBe('100%');
  });

  it('uses the vi-VN decimal comma, like Intl percent formatting', () => {
    expect(formatPercent(37.5, 'vi-VN')).toBe('37,5%');
    expect(formatPercent(0, 'vi-VN')).toBe('0%');
    expect(formatPercent(37.5, 'vi-VN')).toBe(
      new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 1 }).format(0.375),
    );
  });
});
