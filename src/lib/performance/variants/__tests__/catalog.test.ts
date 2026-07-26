import { ACCOMPANIMENT_IDS } from '@/data/labels';
import {
  defaultVariantFor,
  isDefaultVariant,
  isVariantOf,
  normalizeVariant,
  resolveVariant,
  variantsFor,
  VARIANT_CATALOG,
} from '@/lib/performance/variants';

describe('the catalog is well formed', () => {
  it('offers several readings of every accompaniment', () => {
    for (const pattern of ACCOMPANIMENT_IDS) {
      expect(variantsFor(pattern).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives every variant a globally unique id namespaced by its accompaniment', () => {
    const seen = new Set<string>();
    for (const pattern of ACCOMPANIMENT_IDS) {
      for (const v of variantsFor(pattern)) {
        expect(v.id.startsWith(`${pattern}.`)).toBe(true);
        expect(seen.has(v.id)).toBe(false);
        seen.add(v.id);
      }
    }
  });

  it('gives every variant a caption and a hint', () => {
    for (const pattern of ACCOMPANIMENT_IDS) {
      for (const v of variantsFor(pattern)) {
        expect(v.label.length).toBeGreaterThan(0);
        expect(v.hint.length).toBeGreaterThan(0);
      }
    }
  });

  it('leaves the first variant of each accompaniment as the untouched original', () => {
    for (const pattern of ACCOMPANIMENT_IDS) {
      const first = variantsFor(pattern)[0];
      expect(first).toBe(defaultVariantFor(pattern));
      expect(first.refine).toBeUndefined();
      expect(first.forcedBase).toBeUndefined();
    }
  });

  it('covers exactly the five accompaniments', () => {
    expect(Object.keys(VARIANT_CATALOG).sort()).toEqual([...ACCOMPANIMENT_IDS].sort());
  });

  it('keeps Natural the only accompaniment that rotates templates', () => {
    const rotating = ACCOMPANIMENT_IDS.flatMap((p) =>
      variantsFor(p).filter((v) => (v.bank?.length ?? 0) > 1),
    );
    expect(rotating.map((v) => v.id)).toEqual(['natural.auto']);
  });
});

describe('resolving a raw id', () => {
  it('finds a variant the accompaniment offers', () => {
    expect(resolveVariant('natural', 'natural.sparse').id).toBe('natural.sparse');
  });

  it('falls back to the default for an unknown or missing id', () => {
    expect(resolveVariant('block', undefined).id).toBe('block.hold');
    expect(resolveVariant('block', 'block.retired').id).toBe('block.hold');
    expect(resolveVariant('block', 42).id).toBe('block.hold');
  });

  it('refuses a variant that belongs to a different accompaniment', () => {
    expect(isVariantOf('block', 'natural.sparse')).toBe(false);
    expect(resolveVariant('block', 'natural.sparse').id).toBe('block.hold');
  });

  it('normalizes to an id the accompaniment actually offers', () => {
    for (const pattern of ACCOMPANIMENT_IDS) {
      expect(isVariantOf(pattern, normalizeVariant(pattern, 'nonsense'))).toBe(true);
    }
  });
});

describe('isDefaultVariant', () => {
  it('is true for the original reading and for anything unrecognised', () => {
    expect(isDefaultVariant('natural', 'natural.auto')).toBe(true);
    expect(isDefaultVariant('natural', undefined)).toBe(true);
    expect(isDefaultVariant('eightBeat', 'natural.sparse')).toBe(true);
  });

  it('is false once the player picks something else', () => {
    expect(isDefaultVariant('natural', 'natural.dense')).toBe(false);
    expect(isDefaultVariant('arpeggio', 'arpeggio.up')).toBe(false);
  });
});
