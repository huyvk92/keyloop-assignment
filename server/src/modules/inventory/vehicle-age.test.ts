import { fixedClock } from '../../lib/clock';
import { localDate } from '../../lib/dates';
import { AGING_THRESHOLD_DAYS } from '@shared/api/vehicles';
import { addDays } from '../../lib/dates';
import { ageFilterToDateRange, ageInDays, agingCutoffDate, isAging } from './vehicle-age';

const TODAY = '2026-10-07';

describe('ageInDays (BR-01)', () => {
  it('is 0 for a vehicle stocked in today (AC-003.1)', () => {
    expect(ageInDays('2026-10-07', TODAY)).toBe(0);
  });

  it('counts 90 and 91 days (AC-003.1, AC-003.2)', () => {
    expect(ageInDays('2026-07-09', TODAY)).toBe(90);
    expect(ageInDays('2026-07-08', TODAY)).toBe(91);
  });

  it('never goes negative for a future stock-in date', () => {
    expect(ageInDays('2026-10-10', TODAY)).toBe(0);
  });

  it('spans DST changes and the leap day by calendar days', () => {
    expect(ageInDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(ageInDays('2026-10-24', '2026-10-26')).toBe(2);
    expect(ageInDays('2028-02-29', '2028-03-01')).toBe(1);
  });

  it('uses the dealership-local date late in the evening (AC-003.5)', () => {
    const today = localDate(new Date('2026-10-07T23:30:00Z'), 'Europe/London');
    expect(ageInDays('2026-07-09', today)).toBe(91);
  });
});

describe('isAging (BR-02, fixed threshold US-014)', () => {
  it('uses a fixed 90-day threshold', () => {
    expect(AGING_THRESHOLD_DAYS).toBe(90);
  });

  it('is false at 90 and true at 91', () => {
    expect(isAging(0)).toBe(false);
    expect(isAging(90)).toBe(false);
    expect(isAging(91)).toBe(true);
  });

  it('turns 90 into 91 / aging the next day without any stored state (AC-003.3, BR-03)', () => {
    const stockIn = '2026-07-09';
    const todayAge = ageInDays(stockIn, localDate(fixedClock('2026-10-07').now(), 'Europe/London'));
    const tomorrowAge = ageInDays(
      stockIn,
      localDate(fixedClock('2026-10-08').now(), 'Europe/London'),
    );
    expect([todayAge, isAging(todayAge)]).toEqual([90, false]);
    expect([tomorrowAge, isAging(tomorrowAge)]).toEqual([91, true]);
  });
});

describe('agingCutoffDate', () => {
  it('is the latest stock-in date that is aging (age 91)', () => {
    expect(agingCutoffDate(TODAY)).toBe('2026-07-08');
    expect(isAging(ageInDays(agingCutoffDate(TODAY), TODAY))).toBe(true);
    expect(isAging(ageInDays('2026-07-09', TODAY))).toBe(false);
  });
});

describe('ageFilterToDateRange (BR-05, BR-07, TA-07, TA-22)', () => {
  /** Ages 0..200 plus a future-dated row (age clamped to 0) that a range keeps or drops. */
  const stockInDates = [
    addDays(TODAY, 3),
    ...Array.from({ length: 201 }, (_, age) => addDays(TODAY, -age)),
  ];

  /** Ages (clamped) of the stock-in dates inside the range, mirroring the SQL predicate. */
  function agesIn(range: ReturnType<typeof ageFilterToDateRange>): number[] {
    if (range === null) return [];
    return stockInDates
      .filter(
        (d) =>
          (range.from === undefined || d >= range.from) &&
          (range.to === undefined || d <= range.to),
      )
      .map((d) => ageInDays(d, TODAY));
  }
  const span = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);

  it('applies no bounds without an age filter', () => {
    expect(ageFilterToDateRange({}, TODAY)).toEqual({});
    expect(ageFilterToDateRange({ agingOnly: false }, TODAY)).toEqual({});
  });

  it('maps 0-30 to [today-30, open] so future-dated rows stay in (TA-22)', () => {
    const range = ageFilterToDateRange({ ageBucket: '0-30' }, TODAY);

    expect(range).toEqual({ from: '2026-09-07' });
    expect(agesIn(range)).toEqual([0, ...span(0, 30)]);
  });

  it('maps 31-60 inclusively: 31 and 60 in, 30 and 61 out (AC-002.3)', () => {
    const range = ageFilterToDateRange({ ageBucket: '31-60' }, TODAY);

    expect(range).toEqual({ from: addDays(TODAY, -60), to: addDays(TODAY, -31) });
    const ages = agesIn(range);
    expect(ages).toEqual(span(31, 60));
    expect(ages).not.toContain(30);
    expect(ages).not.toContain(61);
  });

  it('maps 61-90 inclusively', () => {
    const range = ageFilterToDateRange({ ageBucket: '61-90' }, TODAY);

    expect(range).toEqual({ from: addDays(TODAY, -90), to: addDays(TODAY, -61) });
    expect(agesIn(range)).toEqual(span(61, 90));
  });

  it('starts over-90 at 91 with no lower date bound (AC-002.3)', () => {
    const range = ageFilterToDateRange({ ageBucket: 'over-90' }, TODAY);

    expect(range).toEqual({ to: agingCutoffDate(TODAY) });
    expect(agesIn(range)).toEqual(span(91, 200));
  });

  it('maps the custom range 45-90 inclusively (AC-002.4)', () => {
    const range = ageFilterToDateRange({ minAge: 45, maxAge: 90 }, TODAY);

    expect(range).toEqual({ from: addDays(TODAY, -90), to: addDays(TODAY, -45) });
    expect(agesIn(range)).toEqual(span(45, 90));
  });

  it('supports open-ended ranges and min = max', () => {
    expect(agesIn(ageFilterToDateRange({ minAge: 195 }, TODAY))).toEqual(span(195, 200));
    expect(agesIn(ageFilterToDateRange({ minAge: 77, maxAge: 77 }, TODAY))).toEqual([77]);
  });

  it('adds no upper date bound for min 0 (TA-22)', () => {
    expect(ageFilterToDateRange({ minAge: 0, maxAge: 0 }, TODAY)).toEqual({ from: TODAY });
    expect(agesIn(ageFilterToDateRange({ minAge: 0, maxAge: 0 }, TODAY))).toEqual([0, 0]);
    expect(ageFilterToDateRange({ minAge: 0 }, TODAY)).toEqual({});
  });

  it('maps agingOnly to the aging cutoff, 91+ (AC-004.3)', () => {
    const range = ageFilterToDateRange({ agingOnly: true }, TODAY);

    expect(range).toEqual({ to: agingCutoffDate(TODAY) });
    expect(agesIn(range)).toEqual(span(91, 200));
  });

  it('intersects bucket, range and agingOnly (BR-05, TA-07)', () => {
    expect(agesIn(ageFilterToDateRange({ ageBucket: 'over-90', maxAge: 120 }, TODAY))).toEqual(
      span(91, 120),
    );
    expect(
      agesIn(ageFilterToDateRange({ ageBucket: '61-90', minAge: 45, maxAge: 70 }, TODAY)),
    ).toEqual(span(61, 70));
    expect(
      agesIn(ageFilterToDateRange({ minAge: 80, maxAge: 100, agingOnly: true }, TODAY)),
    ).toEqual(span(91, 100));
    expect(
      agesIn(
        ageFilterToDateRange(
          { ageBucket: 'over-90', minAge: 150, maxAge: 160, agingOnly: true },
          TODAY,
        ),
      ),
    ).toEqual(span(150, 160));
  });

  it('returns null for an empty intersection (0 rows, not an error)', () => {
    expect(ageFilterToDateRange({ ageBucket: '0-30', agingOnly: true }, TODAY)).toBeNull();
    expect(ageFilterToDateRange({ ageBucket: '31-60', minAge: 61 }, TODAY)).toBeNull();
    expect(ageFilterToDateRange({ ageBucket: '61-90', maxAge: 60 }, TODAY)).toBeNull();
    expect(ageFilterToDateRange({ minAge: 0, maxAge: 90, agingOnly: true }, TODAY)).toBeNull();
  });

  it('is pure: the bounds move with today (BR-03)', () => {
    expect(ageFilterToDateRange({ ageBucket: '31-60' }, '2026-10-08')).toEqual({
      from: '2026-08-09',
      to: '2026-09-07',
    });
  });
});
