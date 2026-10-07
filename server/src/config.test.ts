import { loadConfig } from './config';
import { fixedClock } from './lib/clock';

describe('loadConfig', () => {
  it('applies defaults', () => {
    expect(loadConfig({})).toMatchObject({
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: 3001,
      DATABASE_PATH: 'data/app.db',
      LOG_LEVEL: 'info',
    });
  });

  it('coerces PORT and accepts a valid APP_TODAY', () => {
    expect(loadConfig({ PORT: '4000', APP_TODAY: '2026-10-07' })).toMatchObject({
      PORT: 4000,
      APP_TODAY: '2026-10-07',
    });
  });

  it('rejects invalid values', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow();
    expect(() => loadConfig({ APP_TODAY: '07/10/2026' })).toThrow();
  });
});

describe('fixedClock', () => {
  it('always returns the pinned date', () => {
    expect(fixedClock('2026-10-07').now().toISOString()).toBe('2026-10-07T12:00:00.000Z');
  });

  it('rejects an invalid date', () => {
    expect(() => fixedClock('not-a-date')).toThrow('Invalid date');
  });
});
