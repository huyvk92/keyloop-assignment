import { vi } from 'vitest';

/**
 * Fake timers without `shouldAdvanceTime`, so the clock only moves when the test says so (e.g. a
 * debounce). Testing Library drains its async wrapper with a `setTimeout(0)` and advances it only
 * when it detects Jest fake timers; the `jest` shim lets it advance Vitest's clock by 0 ms the
 * same way. Pair with `stopManualClock()` in `afterEach`, and use `userEvent.setup({ delay: null })`
 * so user-event itself schedules no timers.
 */
export function startManualClock() {
  vi.useFakeTimers();
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });
}

/** Undo `startManualClock()`. Safe to call when it was not started. */
export function stopManualClock() {
  vi.useRealTimers();
  vi.unstubAllGlobals();
}
