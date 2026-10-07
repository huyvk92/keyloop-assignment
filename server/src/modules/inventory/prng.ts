/**
 * Seeded pseudo-random generator (mulberry32) for deterministic demo data. Not cryptographic;
 * avoids a faker dependency (TRD 4.5).
 */
export function createPrng(seed: number) {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };

  /** Integer in [min, max], inclusive. */
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error('Cannot pick from an empty list');
    return items[int(0, items.length - 1)] as T;
  };

  /** Fisher-Yates shuffle into a new array. */
  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = int(0, i);
      [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
    }
    return copy;
  };

  return { next, int, pick, shuffle, chance: (p: number) => next() < p };
}

export type Prng = ReturnType<typeof createPrng>;
