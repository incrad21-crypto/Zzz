export type SeededRng = () => number;

/**
 * Deterministic 32-bit Mulberry32 PRNG for reproducible tests, anomaly timing, and atmospheric variation.
 */
export function createSeededRng(seed: number): SeededRng {
  let state = (Number.isFinite(seed) ? Math.floor(seed) : 1) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRange(rng: SeededRng, min: number, max: number): number {
  return min + rng() * (max - min);
}
