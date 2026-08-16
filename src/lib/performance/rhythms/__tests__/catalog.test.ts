import { ACCOMPANIMENT_HINTS, ACCOMPANIMENT_IDS, ACCOMPANIMENT_LABELS } from '@/data/labels';
import { isAccompanimentPattern, normalizeAccompaniment } from '@/lib/accompaniment';
import { RHYTHMS, rhythmFor } from '@/lib/performance/rhythms';
import { defaultVariantFor, variantsFor } from '@/lib/performance/variants';

describe('the catalog is the one list', () => {
  it('gives every rhythm a unique id and lookup', () => {
    const ids = RHYTHMS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RHYTHMS) expect(rhythmFor(r.id)).toBe(r);
  });

  it('drives the selector, so a chip can never name a rhythm the engine lacks', () => {
    expect([...ACCOMPANIMENT_IDS]).toEqual(RHYTHMS.map((r) => r.id));
    for (const r of RHYTHMS) {
      expect(ACCOMPANIMENT_LABELS[r.id]).toBe(r.label);
      expect(ACCOMPANIMENT_HINTS[r.id]).toBe(r.hint);
    }
  });

  it('drives the read path, so a saved rhythm survives a reload', () => {
    for (const r of RHYTHMS) {
      expect(isAccompanimentPattern(r.id)).toBe(true);
      expect(normalizeAccompaniment(r.id)).toBe(r.id);
    }
  });

  it('labels each rhythm distinctly — two chips reading alike is a bug', () => {
    const labels = RHYTHMS.map((r) => r.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const r of RHYTHMS) expect(r.hint.length).toBeGreaterThan(0);
  });

  it('offers variants for every rhythm, the first being its default', () => {
    for (const r of RHYTHMS) {
      const variants = variantsFor(r.id);
      // Block and City Type1 each have one approved public reading.
      expect(variants.length).toBeGreaterThan(r.id === 'block' || r.id === 'city' ? 0 : 1);
      expect(defaultVariantFor(r.id)).toBe(variants[0]);
      // The default is the reading the rhythm was authored as, never a bend of it.
      expect(variants[0].refine).toBeUndefined();
      for (const v of variants) expect(v.id.startsWith(`${r.id}.`)).toBe(true);
    }
  });
});

describe('promoting the branch to a table kept each kind on its old path', () => {
  it('routes the three feels to their own feel, never each other', () => {
    for (const id of ['natural', 'driving', 'relaxed'] as const) {
      const source = rhythmFor(id)?.source;
      expect(source).toEqual({ kind: 'feel', feelId: id });
    }
  });

  it('leaves the two textures without Variation or groove-lock, as before', () => {
    for (const id of ['block', 'arpeggio'] as const) {
      const source = rhythmFor(id)?.source;
      expect(source?.kind).toBe('style');
      if (source?.kind !== 'style') throw new Error('unreachable');
      expect(source.variation).toBeUndefined();
      expect(source.grooveLock).toBeFalsy();
      expect(source.humanizeScale).toBeUndefined();
    }
  });

  it('routes City through its independent attack-group realizer', () => {
    expect(rhythmFor('city')?.source).toEqual({ kind: 'independent', beatsPerBar: 4 });
  });
});

describe('an authored rhythm carries its own bar', () => {
  const authored = RHYTHMS.filter(
    (r) => r.source.kind === 'style' && r.source.variation !== undefined,
  );

  it('has at least one', () => {
    expect(authored.length).toBeGreaterThan(0);
  });

  it('breathes and agrees with the kit', () => {
    for (const r of authored) {
      if (r.source.kind !== 'style') throw new Error('unreachable');
      expect(r.source.grooveLock).toBe(true);
      // A player who named a rhythm asked for its chords; dropping a whole bar of
      // them reads as a dropout rather than a choice.
      expect(r.source.variation?.bassOnly.probability).toBe(0);
    }
  });

  it('states a bar whose patterns match the declared grid', () => {
    for (const r of authored) {
      if (r.source.kind !== 'style') throw new Error('unreachable');
      const { style } = r.source;
      expect(style.beatsPerBar).toBeGreaterThan(0);
      for (const track of ['chord', 'bass', 'kick', 'snare', 'hat'] as const) {
        expect(style[track].hits).toHaveLength(style.stepsPerBar);
        expect(style[track].accent).toHaveLength(style.stepsPerBar);
      }
    }
  });
});
