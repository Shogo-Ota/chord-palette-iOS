/**
 * Deterministic pseudo-random number generator for the Performance Engine
 * (pure, UI/RN/Expo/native-independent). The design (`natural-performance-engine.md`
 * §1 / §4.3) requires that the same `seed` always reproduces the same performance
 * — so `Math.random` is banned everywhere in `src/lib/performance`; every random
 * value must come from a seeded stream created here.
 *
 * `mulberry32` is a small, fast, well-distributed 32-bit PRNG. `hashSeed` derives a
 * stable 32-bit integer from a project seed plus salt parts (track / bar / step /
 * purpose), so each concern gets its own independent-but-reproducible stream while
 * a single project `seed` still governs the whole result.
 */

/** FNV-1a 32-bit hash of the joined parts → a stable, well-mixed uint32 stream key. */
export function hashSeed(...parts: (number | string)[]): number {
  let h = 0x811c9dc5;
  const str = parts.join('|');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A seeded random stream. All values are a deterministic function of the seed. */
export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [minIncl, maxIncl]. */
  int(minIncl: number, maxIncl: number): number;
  /** true with probability `p` (default 0.5). */
  bool(p?: number): boolean;
  /** Pick one element (deterministically) from a non-empty array. */
  pick<T>(items: readonly T[]): T;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Create a deterministic stream. Accepts a raw uint32 seed. */
export function createRng(seed: number): Rng {
  const next = mulberry32(seed >>> 0);
  return {
    next,
    range(min: number, max: number): number {
      return min + next() * (max - min);
    },
    int(minIncl: number, maxIncl: number): number {
      if (maxIncl < minIncl) return minIncl;
      return minIncl + Math.floor(next() * (maxIncl - minIncl + 1));
    },
    bool(p = 0.5): boolean {
      return next() < p;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('rng.pick: empty array');
      return items[Math.floor(next() * items.length)];
    },
  };
}

/** Convenience: a stream keyed by a project seed plus salt parts. */
export function streamFor(seed: number, ...parts: (number | string)[]): Rng {
  return createRng(hashSeed(seed, ...parts));
}
