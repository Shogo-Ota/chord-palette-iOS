import { ACCOMPANIMENT_IDS } from '@/data/labels';
import { humanTemplateById } from '@/lib/performance/humanTemplate';
import { CORE_PATTERNS } from '@/lib/performance/model/styleCards';
import {
  defaultVariantFor,
  isDefaultVariant,
  isVariantOf,
  normalizeVariant,
  offeredVariantsFor,
  resolveVariant,
  variantsFor,
  VARIANT_CATALOG,
} from '@/lib/performance/variants';

describe('the catalog is well formed', () => {
  it('offers several readings of every accompaniment that has Types', () => {
    for (const pattern of ACCOMPANIMENT_IDS) {
      if (pattern === 'block' || pattern === 'city') {
        expect(variantsFor(pattern)).toHaveLength(1);
        expect(variantsFor(pattern)[0]!.humanTemplateId).toBeUndefined();
        continue;
      }
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

  it('covers every accompaniment in the rhythm catalog', () => {
    expect(Object.keys(VARIANT_CATALOG).sort()).toEqual([...ACCOMPANIMENT_IDS].sort());
  });

  it('names a real human take for every Type the Style screen offers', () => {
    for (const pattern of CORE_PATTERNS) {
      if (pattern === 'block' || pattern === 'city') continue;
      const types = offeredVariantsFor(pattern);
      expect(types.length).toBeGreaterThan(0);
      for (const t of types) {
        // No Type may be invented to round a list up: each one must resolve to a take
        // that actually loads from the approved pattern pool.
        expect(t.humanTemplateId).toBeDefined();
        expect(humanTemplateById(t.humanTemplateId!)).toBeDefined();
      }
      // And no two Types may be the same take wearing two labels.
      const takes = types.map((t) => t.humanTemplateId);
      expect(new Set(takes).size).toBe(takes.length);
    }
  });

  it('offers exactly the eight Production Types', () => {
    const slots = CORE_PATTERNS.flatMap((pattern) =>
      offeredVariantsFor(pattern).map((v) => `${pattern}/${v.id}`),
    );
    expect(slots).toEqual([
      'block/block.type1',
      'natural/natural.type1',
      'natural/natural.type2',
      'natural/natural.type3',
      'city/city.type1',
      'arpeggio/arpeggio.type1',
      'arpeggio/arpeggio.type2',
      'arpeggio/arpeggio.type3',
    ]);
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
    expect(resolveVariant('block', undefined).id).toBe('block.type1');
    expect(resolveVariant('block', 'block.retired').id).toBe('block.type1');
    expect(resolveVariant('block', 42).id).toBe('block.type1');
  });

  it('refuses a variant that belongs to a different accompaniment', () => {
    expect(isVariantOf('block', 'natural.sparse')).toBe(false);
    expect(resolveVariant('block', 'natural.sparse').id).toBe('block.type1');
  });

  it('normalizes to an id the accompaniment actually offers', () => {
    for (const pattern of ACCOMPANIMENT_IDS) {
      expect(isVariantOf(pattern, normalizeVariant(pattern, 'nonsense'))).toBe(true);
    }
  });
});

describe('isDefaultVariant', () => {
  it('is true for the original reading and for anything unrecognised', () => {
    expect(isDefaultVariant('natural', 'natural.type1')).toBe(true);
    expect(isDefaultVariant('natural', undefined)).toBe(true);
    expect(isDefaultVariant('eightBeat', 'natural.sparse')).toBe(true);
  });

  it('is false once the player picks something else', () => {
    expect(isDefaultVariant('natural', 'natural.type2')).toBe(false);
    expect(isDefaultVariant('natural', 'natural.auto')).toBe(false);
    expect(isDefaultVariant('arpeggio', 'arpeggio.type3')).toBe(false);
  });
});
