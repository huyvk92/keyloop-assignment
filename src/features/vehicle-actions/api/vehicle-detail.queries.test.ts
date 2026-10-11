import { vehicleDetailOptions, vehicleKeys } from './vehicle-detail.queries';

describe('vehicle detail query (T-034)', () => {
  it('is keyed by vehicle id only', () => {
    expect(vehicleKeys.detail(7)).toEqual(['vehicles', 'detail', 7]);
    expect(vehicleDetailOptions(7).queryKey).toEqual(['vehicles', 'detail', 7]);
  });

  it('polls like the dashboard: every 60 s while visible, and on focus (TA-14, AC-009.3)', () => {
    const options = vehicleDetailOptions(7);

    expect(options.refetchInterval).toBe(60_000);
    expect(options.refetchIntervalInBackground).toBe(false);
    expect(options.refetchOnWindowFocus).toBe(true);
    // No placeholder: another vehicle's history must never show under this one.
    expect(options.placeholderData).toBeUndefined();
  });
});
