import { harmonicRoleVisuals } from '@/lib/videoExport/harmonicRoleVisuals';
import {
  resolveVisualHarmonicRole,
  visualHarmonicRoles,
  type VisualHarmonicRole,
} from '@/lib/videoExport/visualHarmonicRole';
import { HARMONIC_VISUAL_TOKENS } from '@/theme/videoHarmonicTokens';
import { functionColor } from '@/theme/tokens';
import type { ChordCategory, ChordEvent, ChordFunction } from '@/types';

function role(input: {
  function?: ChordFunction;
  category?: ChordCategory;
  chordId?: string;
}): VisualHarmonicRole {
  return resolveVisualHarmonicRole(input).role;
}

/** The id a passing-diminished card carries, which is how its rule is recovered. */
const dimId = (rule: string) => `passing-diminished-C-${rule}`;

describe('what a chord is doing decides how it reads', () => {
  it.each<
    [string, { function?: ChordFunction; category?: ChordCategory; chordId?: string }, VisualHarmonicRole]
  >([
    ['Cmaj7 as tonic', { function: 'tonic', category: 'diatonic' }, 'stable'],
    ['Fmaj7 as subdominant', { function: 'subdominant', category: 'diatonic' }, 'motion'],
    ['G7 as dominant', { function: 'dominant', category: 'diatonic' }, 'tension'],
    ['E7 → Am7', { function: 'dominant', category: 'secondaryDominant' }, 'secondaryTension'],
    [
      'G#dim7 → Am7',
      {
        function: 'dominant',
        category: 'passingDiminished',
        chordId: dimId('sharp-five-to-six'),
      },
      'leadingTension',
    ],
    ['D♭7 → Cmaj7', { function: 'dominant', category: 'substituteChord' }, 'tension'],
    ['E♭maj7 as colour', { function: 'tonic', category: 'chromaticMediant' }, 'color'],
    ['Caug → F', { function: 'tonic', category: 'augmentedTriad' }, 'transition'],
  ])('reads %s as %s', (_label, input, expected) => {
    expect(role(input)).toBe(expected);
  });

  it('falls back to neutral when nothing is known', () => {
    expect(resolveVisualHarmonicRole({})).toEqual({ role: 'neutral', confidence: 'fallback' });
  });

  it('reports whether a role was decided by technique or derived from function', () => {
    expect(
      resolveVisualHarmonicRole({
        category: 'passingDiminished',
        chordId: dimId('sharp-one-to-two'),
      }).confidence,
    ).toBe('explicit');
    expect(
      resolveVisualHarmonicRole({ category: 'modalInterchange', function: 'subdominant' })
        .confidence,
    ).toBe('derived');
    expect(resolveVisualHarmonicRole({ function: 'tonic' }).confidence).toBe('fallback');
  });
});

/**
 * The four diminished connectors are the case the resolver exists for, and the case the
 * category alone cannot answer.
 *
 * `♭III°7` and `#IV°7` sound the same four pitches in C — a diminished seventh is
 * symmetric — yet one decorates ii by voice leading and the other is the dominant of V.
 * Colouring both the same would be colouring by notes, which is what the role system
 * exists not to do.
 */
describe('a diminished seventh is read by what it does, not by being diminished', () => {
  it.each<[string, string, VisualHarmonicRole]>([
    ['C#dim7 → Dm7 (vii°7/ii)', 'sharp-one-to-two', 'leadingTension'],
    ['E♭dim7 → Dm7 (chromatic passing)', 'flat-three-to-two', 'transition'],
    ['F#dim7 → G7 (vii°7/V)', 'sharp-four-to-five', 'leadingTension'],
    ['G#dim7 → Am7 (vii°7/vi)', 'sharp-five-to-six', 'leadingTension'],
  ])('reads %s as %s', (_label, rule, expected) => {
    expect(role({ category: 'passingDiminished', chordId: dimId(rule) })).toBe(expected);
  });

  it('gives the same four notes different roles when they do different work', () => {
    const chromatic = role({ category: 'passingDiminished', chordId: dimId('flat-three-to-two') });
    const dominant = role({ category: 'passingDiminished', chordId: dimId('sharp-four-to-five') });
    expect(chromatic).not.toBe(dominant);
  });

  /**
   * Never guess. A diminished card whose rule cannot be recovered has not said what it is
   * doing, and defaulting to the loudest role would be the worst available answer.
   */
  it('falls back to neutral rather than assuming tension', () => {
    expect(resolveVisualHarmonicRole({ category: 'passingDiminished' })).toEqual({
      role: 'neutral',
      confidence: 'fallback',
    });
    expect(role({ category: 'passingDiminished', chordId: 'passing-diminished-C-unknown' })).toBe(
      'neutral',
    );
    // Even a stamped function must not smuggle a role in through the back door.
    expect(role({ function: 'dominant', category: 'passingDiminished' })).toBe('neutral');
  });
});

/**
 * Borrowing from the parallel minor says where a chord came from, not what force it
 * applies. `Fm` in C is subdominant motion and `B♭7` is a dominant pull, so the category
 * defers to the function rather than flattening both into one colour.
 */
describe('a borrowed chord keeps the force it applies', () => {
  it.each<[string, ChordFunction, VisualHarmonicRole]>([
    ['IVm (Fm)', 'subdominant', 'motion'],
    ['♭VII7 (B♭7)', 'dominant', 'tension'],
    ['♭III (E♭maj7 borrowed)', 'tonic', 'stable'],
  ])('reads %s as %s', (_label, fn, expected) => {
    expect(role({ function: fn, category: 'modalInterchange' })).toBe(expected);
  });

  /**
   * Knowing a chord was borrowed is real information. With no function to defer to it
   * reads as colour, because "borrowed from somewhere" is a statement about the chord —
   * unlike neutral, which means nothing is known at all.
   */
  it('reads as colour when the function is missing but the borrowing is known', () => {
    expect(resolveVisualHarmonicRole({ category: 'modalInterchange' })).toEqual({
      role: 'color',
      confidence: 'derived',
    });
  });
});

describe('neutral means nothing is known, and only that', () => {
  it('is reached with neither a category nor a function', () => {
    expect(resolveVisualHarmonicRole({})).toEqual({ role: 'neutral', confidence: 'fallback' });
  });

  /**
   * These three carry no role of their own: a diatonic chord, a decorated one and a slash
   * chord are all defined by the function underneath them, so without it there is nothing
   * to say.
   */
  it.each<ChordCategory>(['diatonic', 'variation', 'slash'])(
    'is reached for %s when the function is missing',
    (category) => {
      expect(role({ category })).toBe('neutral');
    },
  );

  it('is never reached when a function is available', () => {
    for (const fn of ['tonic', 'subdominant', 'dominant'] as const) {
      for (const category of [undefined, 'diatonic', 'slash', 'modalInterchange'] as const) {
        expect(role({ function: fn, category })).not.toBe('neutral');
      }
    }
  });
});

describe('the palette keeps the five families apart', () => {
  it('gives every role its own fill', () => {
    const fills = Object.values(HARMONIC_VISUAL_TOKENS).map((token) => token.main);
    expect(new Set(fills).size).toBe(fills.length);
  });

  it('never repeats a harmonic-function colour, so the systems stay distinguishable', () => {
    const functionColors = new Set(Object.values(functionColor));
    for (const token of Object.values(HARMONIC_VISUAL_TOKENS)) {
      expect(functionColors.has(token.main)).toBe(false);
    }
  });

  /**
   * Light is the chord's own colour getting brighter. A fill under a glow of a different
   * hue reads as two unrelated things at once, so every layer has to share the fill's
   * dominant channel ordering.
   */
  it('keeps every layer in the same hue family as the fill', () => {
    const rank = (hex: string) => {
      const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
      return channels
        .map((value, index) => ({ value, index }))
        .sort((a, b) => b.value - a.value)
        .map(({ index }) => index)
        .join('');
    };
    for (const [name, token] of Object.entries(HARMONIC_VISUAL_TOKENS)) {
      const expected = rank(token.main);
      for (const layer of ['outline', 'glowCore', 'glowOuter', 'note'] as const) {
        expect({ name, layer, order: rank(token[layer]) }).toEqual({
          name,
          layer,
          order: expected,
        });
      }
    }
  });

  it('makes the rim and the core brighter than the fill, so they read as light', () => {
    const luma = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    for (const [name, token] of Object.entries(HARMONIC_VISUAL_TOKENS)) {
      expect({ name, brighter: luma(token.outline) > luma(token.main) }).toEqual({
        name,
        brighter: true,
      });
      expect({ name, brightest: luma(token.glowCore) > luma(token.outline) }).toEqual({
        name,
        brightest: true,
      });
      // Notes sit under the chord name in the hierarchy, so they stay calmer than it.
      expect({ name, calmer: luma(token.note) < luma(token.main) }).toEqual({
        name,
        calmer: true,
      });
    }
  });
});

/**
 * The palette is also the switch that decides which chords get any of this. An entry means
 * "paint this one by its role"; no entry means "render it exactly as Flow always did".
 * Lighting every chord marks none of them.
 */
describe('the palette handed to the renderer', () => {
  const event = (fn: ChordFunction, category?: ChordCategory, chordId?: string): ChordEvent =>
    ({ function: fn, category, chordId }) as unknown as ChordEvent;

  const diatonic = [
    event('tonic', 'diatonic'),
    event('subdominant', 'diatonic'),
    event('dominant', 'diatonic'),
    event('tonic', 'diatonic'),
  ];

  it('sends nothing at all for a fully diatonic progression', () => {
    expect(harmonicRoleVisuals(diatonic)).toEqual([]);
  });

  it.each<[string, ChordCategory]>([
    ['a decorated diatonic chord', 'variation'],
    ['a slash chord', 'slash'],
    ['the minor primary dominant', 'primaryDominant'],
  ])('leaves %s untouched', (_label, category) => {
    expect(harmonicRoleVisuals([event('tonic', category)])).toEqual([]);
  });

  it('marks only the advanced-harmony position, by its index in the pass', () => {
    const progression = [
      ...diatonic.slice(0, 2),
      event('dominant', 'passingDiminished', 'passing-diminished-C-sharp-five-to-six'),
      diatonic[3]!,
    ];
    expect(harmonicRoleVisuals(progression).map((entry) => [entry.cycleIndex, entry.role])).toEqual([
      [2, 'leadingTension'],
    ]);
  });

  it('gives the two kinds of diminished connector different colours', () => {
    const entries = harmonicRoleVisuals([
      event('dominant', 'passingDiminished', 'passing-diminished-C-sharp-four-to-five'),
      event('subdominant', 'passingDiminished', 'passing-diminished-C-flat-three-to-two'),
    ]);
    expect(entries.map((entry) => entry.role)).toEqual(['leadingTension', 'transition']);
    expect(entries[0]!.main).not.toBe(entries[1]!.main);
  });

  it('sends the token colours unchanged, so the renderer makes no colour decisions', () => {
    const [entry] = harmonicRoleVisuals([
      event('dominant', 'passingDiminished', 'passing-diminished-C-sharp-five-to-six'),
    ]);
    expect(entry).toMatchObject(HARMONIC_VISUAL_TOKENS.leadingTension);
  });

  /** A chord that reached neutral has said nothing, so it gets the untouched path too. */
  it('omits a chord whose role could not be decided', () => {
    expect(harmonicRoleVisuals([event('dominant', 'passingDiminished')])).toEqual([]);
  });

  it('agrees with the role list used elsewhere', () => {
    const progression = [
      event('dominant', 'secondaryDominant'),
      event('subdominant', 'modalInterchange'),
    ];
    expect(harmonicRoleVisuals(progression).map((entry) => entry.role)).toEqual(
      visualHarmonicRoles(progression),
    );
  });
});
