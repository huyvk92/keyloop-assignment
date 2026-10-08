import { act, renderHook } from '@testing-library/react';
import { i18n } from '@/i18n';
import { useFormatters } from '@/lib/use-formatters';

describe('useFormatters', () => {
  it('formats in English by default and follows a language change (TA-26)', async () => {
    const { result } = renderHook(() => useFormatters());

    expect(result.current.locale).toBe('en-GB');
    expect(result.current.money(2599000, 'GBP')).toBe('£25,990');
    expect(result.current.date('2026-10-07')).toBe('07 Oct 2026');
    expect(result.current.dateTime('2026-10-07T13:32:00.000Z', 'Europe/London')).toBe(
      '07 Oct 2026, 14:32',
    );
    expect(result.current.mileage(12345)).toBe('12,345 mi');
    expect(result.current.integer(1200)).toBe('1,200');
    expect(result.current.percent(37.5)).toBe('37.5%');

    await act(() => i18n.changeLanguage('vi'));

    expect(result.current.locale).toBe('vi-VN');
    expect(result.current.money(2599000, 'GBP')).toBe('25.990 £');
    expect(result.current.date('2026-10-07')).toBe('07/10/2026');
    expect(result.current.dateTime('2026-10-07T13:32:00.000Z', 'Europe/London')).toBe(
      '07/10/2026 14:32',
    );
    expect(result.current.mileage(12345)).toBe('12.345 mi');
    expect(result.current.integer(1200)).toBe('1.200');
    expect(result.current.percent(37.5)).toBe('37,5%');
  });
});
