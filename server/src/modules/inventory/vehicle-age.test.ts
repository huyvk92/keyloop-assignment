import { fixedClock } from '../../lib/clock';
import { localDate } from '../../lib/dates';
import { AGING_THRESHOLD_DAYS } from '@shared/api/vehicles';
import { ageInDays, agingCutoffDate, isAging } from './vehicle-age';

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
