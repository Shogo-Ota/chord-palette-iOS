import { createRng, hashSeed, streamFor } from '@/lib/performance/rng';

describe('rng — deterministic PRNG (no Math.random)', () => {
  it('hashSeed is stable and order-sensitive', () => {
    expect(hashSeed(1, 'a', 2)).toBe(hashSeed(1, 'a', 2));
    expect(hashSeed(1, 'a', 2)).not.toBe(hashSeed(1, 2, 'a'));
    expect(hashSeed('kick', 0)).not.toBe(hashSeed('kick', 1));
  });

  it('same seed yields the identical sequence', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds diverge', () => {
    const a = Array.from({ length: 20 }, ((r) => () => r.next())(createRng(1)));
    const b = Array.from({ length: 20 }, ((r) => () => r.next())(createRng(2)));
    expect(a).not.toEqual(b);
  });

  it('next() stays within [0, 1)', () => {
    const r = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range / int / pick respect their bounds', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const f = r.range(-5, 5);
      expect(f).toBeGreaterThanOrEqual(-5);
      expect(f).toBeLessThan(5);
      const n = r.int(2, 6);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(6);
      expect(Number.isInteger(n)).toBe(true);
      expect([10, 20, 30]).toContain(r.pick([10, 20, 30]));
    }
  });

  it('streamFor derives independent-but-reproducible streams', () => {
    expect(streamFor(1, 'x').next()).toBe(streamFor(1, 'x').next());
    expect(streamFor(1, 'x').next()).not.toBe(streamFor(1, 'y').next());
  });
});
