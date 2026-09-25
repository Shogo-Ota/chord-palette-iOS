import { beatsPerBarFor } from '@/lib/performance/rhythms';
import {
  chordStyleKey,
  distinctChordStyles,
  normalizeChordStyleOverride,
  normalizeChordStyleOverrides,
  resolveEffectiveStyles,
  PUBLIC_CHORD_STYLES,
  type EffectiveChordStyle,
} from '@/lib/performance/style';
import { PUBLIC_ACCOMPANIMENT_PATTERNS } from '@/lib/performance/publicAccompaniment';
import { offeredVariantsFor } from '@/lib/performance/variants';
import type { ChordEvent } from '@/types';

const GLOBAL: EffectiveChordStyle = { pattern: 'natural', variant: 'natural.type1' };

function chord(override?: unknown): ChordEvent {
  return {
    id: 'c',
    chordId: 'c',
    displayName: 'C',
    degreeLabel: 'I',
    function: 'tonic',
    durationBeats: 4,
    isPro: false,
    rootOffset: 0,
    suffix: '',
    ...(override === undefined ? {} : { accompanimentOverride: override as never }),
  };
}

describe('public override set', () => {
  it('offers exactly the eight release STYLEs', () => {
    expect(PUBLIC_CHORD_STYLES.map(chordStyleKey)).toEqual([
      'block/block.type1',
      'natural/natural.type1',
      'natural/natural.type2',
      'natural/natural.type3',
      'natural/natural.type4',
      'natural/natural.type5',
      'natural/natural.dance1',
      'city/city.type1',
    ]);
  });

  it('never exposes the catalogued arpeggio pattern', () => {
    // The arpeggio readings are offered at the variant level, so the pattern list is
    // the only thing keeping them out of an override. Guard that, not the flag.
    expect(offeredVariantsFor('arpeggio').length).toBeGreaterThan(0);
    expect(PUBLIC_ACCOMPANIMENT_PATTERNS).not.toContain('arpeggio');
    expect(PUBLIC_CHORD_STYLES.some((style) => style.pattern === 'arpeggio')).toBe(false);
    // "Arpeggio Type 1" is a Natural reading, not the arpeggio pattern.
    expect(PUBLIC_CHORD_STYLES).toContainEqual({ pattern: 'natural', variant: 'natural.type5' });
  });

  it('keeps one meter for the whole progression (condition D)', () => {
    const meters = new Set(PUBLIC_CHORD_STYLES.map((style) => beatsPerBarFor(style.pattern)));
    expect(meters).toEqual(new Set([4]));
    expect(PUBLIC_ACCOMPANIMENT_PATTERNS.map(beatsPerBarFor)).toEqual([4, 4, 4]);
  });
});

describe('override normalization', () => {
  it.each(PUBLIC_CHORD_STYLES)('accepts the public STYLE %j', (style) => {
    expect(normalizeChordStyleOverride({ ...style }, GLOBAL)).toEqual(style);
  });

  it.each([
    ['unoffered arpeggio reading', { pattern: 'arpeggio', variant: 'arpeggio.type1' }],
    ['non-public pattern', { pattern: 'beat8', variant: 'beat8.pop' }],
    ['variant of another pattern', { pattern: 'block', variant: 'natural.type1' }],
    ['unknown variant', { pattern: 'natural', variant: 'natural.type99' }],
    ['UI label instead of ids', { pattern: 'Arpeggio', variant: 'Type 1' }],
    ['missing variant', { pattern: 'natural' }],
    ['wrong types', { pattern: 1, variant: 2 }],
    ['not an object', 'natural.type1'],
    ['null', null],
    ['undefined', undefined],
  ])('falls back to the global style for %s', (_label, raw) => {
    expect(normalizeChordStyleOverride(raw, GLOBAL)).toBeUndefined();
  });

  it('rejects a candidate whose meter differs from the project', () => {
    const waltz: EffectiveChordStyle = { pattern: 'waltz', variant: 'waltz.type1' };
    expect(beatsPerBarFor(waltz.pattern)).not.toBe(beatsPerBarFor(GLOBAL.pattern));
    expect(normalizeChordStyleOverride(waltz, GLOBAL)).toBeUndefined();
  });

  it('keeps missing and valid persisted fields but removes invalid ones', () => {
    const missing = chord();
    const valid = chord({ pattern: 'city', variant: 'city.type1' });
    const invalid = chord({ pattern: 'arpeggio', variant: 'arpeggio.type1' });
    const onInvalid = jest.fn();

    const normalized = normalizeChordStyleOverrides([missing, valid, invalid], GLOBAL, onInvalid);

    expect(normalized[0]).toBe(missing);
    expect(normalized[0]).not.toHaveProperty('accompanimentOverride');
    expect(normalized[1]?.accompanimentOverride).toEqual({
      pattern: 'city',
      variant: 'city.type1',
    });
    expect(normalized[2]).not.toHaveProperty('accompanimentOverride');
    expect(onInvalid).toHaveBeenCalledWith(invalid, invalid.accompanimentOverride);
  });
});

describe('effectiveStyle resolution', () => {
  it('inherits the global style for every chord without an override', () => {
    const styles = resolveEffectiveStyles([chord(), chord(), chord()], GLOBAL);
    expect(styles).toEqual([GLOBAL, GLOBAL, GLOBAL]);
  });

  it('applies an override to that one chord only', () => {
    const city: EffectiveChordStyle = { pattern: 'city', variant: 'city.type1' };
    const styles = resolveEffectiveStyles([chord(), chord(), chord(city), chord()], GLOBAL);
    expect(styles).toEqual([GLOBAL, GLOBAL, city, GLOBAL]);
  });

  it('follows a new global style on non-overridden chords and holds the override', () => {
    const block: EffectiveChordStyle = { pattern: 'block', variant: 'block.type1' };
    const nextGlobal: EffectiveChordStyle = { pattern: 'city', variant: 'city.type1' };
    const progression = [chord(), chord(block)];
    expect(resolveEffectiveStyles(progression, GLOBAL)).toEqual([GLOBAL, block]);
    expect(resolveEffectiveStyles(progression, nextGlobal)).toEqual([nextGlobal, block]);
  });

  it('groups distinct styles in first-appearance order', () => {
    const block: EffectiveChordStyle = { pattern: 'block', variant: 'block.type1' };
    const city: EffectiveChordStyle = { pattern: 'city', variant: 'city.type1' };
    const resolved = resolveEffectiveStyles(
      [chord(city), chord(), chord(block), chord(city), chord()],
      GLOBAL,
    );
    expect(distinctChordStyles(resolved)).toEqual([city, GLOBAL, block]);
  });

  it('collapses an override that names the global style', () => {
    const resolved = resolveEffectiveStyles([chord(), chord({ ...GLOBAL })], GLOBAL);
    expect(distinctChordStyles(resolved)).toEqual([GLOBAL]);
  });
});
