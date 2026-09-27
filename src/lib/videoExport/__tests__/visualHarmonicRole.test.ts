import { harmonicRoleVisuals } from '@/lib/videoExport/harmonicRoleVisuals';
import {
  resolveVisualHarmonicRole,
  visualHarmonicRoles,
  type VisualHarmonicRole,
} from '@/lib/videoExport/visualHarmonicRole';
import { HARMONIC_VISUAL_TOKENS } from '@/theme/videoHarmonicTokens';
import { functionColor } from '@/theme/tokens';
import {
  suggestionToChordEvent,
  type SuggestionReason,
} from '@/lib/theory/progression/suggestNext';
import type { ChordCategory, ChordEvent, ChordFunction } from '@/types';

function role(input: { category?: ChordCategory; chordId?: string }): VisualHarmonicRole {
  return resolveVisualHarmonicRole(input).role;
}

/** The id a passing-diminished card carries, which is how its rule is recovered. */
const dimId = (rule: string) => `passing-diminished-C-${rule}`;

describe('the technique a chord announces decides its light', () => {
  it.each<[string, { category?: ChordCategory; chordId?: string }, VisualHarmonicRole]>([
    ['E7 → Am7', { category: 'secondaryDominant' }, 'secondaryTension'],
    [
      'G#dim7 → Am7',
      { category: 'passingDiminished', chordId: dimId('sharp-five-to-six') },
      'leadingTension',
    ],
    ['D♭7 → Cmaj7', { category: 'substituteChord' }, 'tension'],
    ['E♭maj7 as colour', { category: 'chromaticMediant' }, 'color'],
    ['Fm borrowed', { category: 'modalInterchange' }, 'color'],
    ['Caug → F', { category: 'augmentedTriad' }, 'transition'],
  ])('reads %s as %s', (_label, input, expected) => {
    expect(role(input)).toBe(expected);
  });

  it('falls back to neutral when no technique is announced', () => {
    expect(resolveVisualHarmonicRole({})).toEqual({ role: 'neutral', confidence: 'fallback' });
  });

  it('reports a technique as an explicit decision', () => {
    expect(
      resolveVisualHarmonicRole({
        category: 'passingDiminished',
        chordId: dimId('sharp-one-to-two'),
      }).confidence,
    ).toBe('explicit');
    expect(resolveVisualHarmonicRole({ category: 'modalInterchange' }).confidence).toBe('explicit');
  });
});

/**
 * The harmonic function is what fills the glyph, so taking the light from it as well would
 * paint one fact twice and put a second hue on screen that competes with the first.
 */
describe('the function never reaches the light', () => {
  it.each<ChordFunction>(['tonic', 'subdominant', 'dominant'])(
    'leaves a plain %s chord with no light at all',
    (fn) => {
      const event = { function: fn, category: 'diatonic' } as unknown as ChordEvent;
      expect(harmonicRoleVisuals([event])).toEqual([]);
    },
  );

  it('gives every borrowed chord the same light whatever force it applies', () => {
    const borrowed = (fn: ChordFunction) =>
      ({ function: fn, category: 'modalInterchange' }) as unknown as ChordEvent;
    const roles = (['tonic', 'subdominant', 'dominant'] as const).map(
      (fn) => harmonicRoleVisuals([borrowed(fn)])[0]!.role,
    );
    expect(new Set(roles)).toEqual(new Set(['color']));
  });

  it('is not consulted even when a technique leaves the role undecided', () => {
    // A diminished card whose rule cannot be recovered stays neutral rather than borrowing
    // the stamped function to produce a colour.
    const event = { function: 'dominant', category: 'passingDiminished' } as unknown as ChordEvent;
    expect(harmonicRoleVisuals([event])).toEqual([]);
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

  it('falls back to neutral rather than assuming tension', () => {
    expect(resolveVisualHarmonicRole({ category: 'passingDiminished' })).toEqual({
      role: 'neutral',
      confidence: 'fallback',
    });
    expect(role({ category: 'passingDiminished', chordId: 'passing-diminished-C-unknown' })).toBe(
      'neutral',
    );
  });
});

describe('neutral means no technique was announced, and only that', () => {
  it.each<ChordCategory>(['diatonic', 'variation', 'slash', 'primaryDominant'])(
    'is reached for %s',
    (category) => {
      expect(role({ category })).toBe('neutral');
    },
  );

  it('is reached with no category at all', () => {
    expect(role({})).toBe('neutral');
  });
});

describe('the palette keeps the light families apart', () => {
  it('gives every role its own accent', () => {
    const accents = Object.values(HARMONIC_VISUAL_TOKENS).map((token) => token.accent);
    expect(new Set(accents).size).toBe(accents.length);
  });

  /**
   * The light has to be tellable from the fill it sits on, and the fill is always one of the
   * three function colours. A role reusing one of them would make an advanced chord look like
   * an ordinary chord of a different function.
   */
  it('never repeats a harmonic-function colour', () => {
    const functionColors = new Set(Object.values(functionColor));
    for (const token of Object.values(HARMONIC_VISUAL_TOKENS)) {
      for (const layer of ['accent', 'outline', 'glowCore', 'glowOuter'] as const) {
        expect({ layer, collides: functionColors.has(token[layer]) }).toEqual({
          layer,
          collides: false,
        });
      }
    }
  });

  /**
   * The light layers share a hue with each other — not with the fill, which is the whole
   * signal. A rim of one hue over a halo of another would read as two effects at once.
   */
  it('keeps every light layer in one hue family', () => {
    const rank = (hex: string) => {
      const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
      return channels
        .map((value, index) => ({ value, index }))
        .sort((a, b) => b.value - a.value)
        .map(({ index }) => index)
        .join('');
    };
    for (const [name, token] of Object.entries(HARMONIC_VISUAL_TOKENS)) {
      const expected = rank(token.accent);
      for (const layer of ['outline', 'glowCore', 'glowOuter'] as const) {
        expect({ name, layer, order: rank(token[layer]) }).toEqual({
          name,
          layer,
          order: expected,
        });
      }
    }
  });

  it('makes the rim and the core brighter than the accent, so they read as light', () => {
    const luma = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    for (const [name, token] of Object.entries(HARMONIC_VISUAL_TOKENS)) {
      expect({ name, brighter: luma(token.outline) > luma(token.accent) }).toEqual({
        name,
        brighter: true,
      });
      expect({ name, brightest: luma(token.glowCore) > luma(token.outline) }).toEqual({
        name,
        brightest: true,
      });
    }
  });
});

/**
 * The palette is also the switch that decides which chords get any of this. An entry means
 * "light this one"; no entry means "render it exactly as Flow always did". Lighting every
 * chord marks none of them.
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
    expect(entries[0]!.accent).not.toBe(entries[1]!.accent);
  });

  it('sends the token colours unchanged, so the renderer makes no colour decisions', () => {
    const [entry] = harmonicRoleVisuals([
      event('dominant', 'passingDiminished', 'passing-diminished-C-sharp-five-to-six'),
    ]);
    expect(entry).toMatchObject(HARMONIC_VISUAL_TOKENS.leadingTension);
  });

  /** No entry carries a fill, because the renderer fills from the segment's own colour. */
  it('never sends a glyph fill', () => {
    const [entry] = harmonicRoleVisuals([event('dominant', 'secondaryDominant')]);
    expect(entry).not.toHaveProperty('main');
    expect(Object.keys(entry!).sort()).toEqual(
      ['accent', 'cycleIndex', 'glowCore', 'glowOuter', 'outline', 'role'].sort(),
    );
  });

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

/**
 * `F` and a borrowed `Fm` are the same subdominant, and the video says so: both are filled
 * amber, and only `Fm` is lit. The difference a viewer sees is the light, not the colour of
 * the letters.
 */
describe('a borrowed chord is filled like its function and marked by light', () => {
  const borrowed = (fn: ChordFunction): ChordEvent =>
    ({ function: fn, category: 'modalInterchange' }) as unknown as ChordEvent;

  it('is treated as advanced harmony, so it gets the outline and glow', () => {
    for (const fn of ['tonic', 'subdominant', 'dominant'] as const) {
      expect(harmonicRoleVisuals([borrowed(fn)])).toHaveLength(1);
    }
  });

  it('carries the borrowed-chord light rather than a light standing for its function', () => {
    const [entry] = harmonicRoleVisuals([borrowed('subdominant')]);
    expect(entry!.role).toBe('color');
    expect(entry).toMatchObject(HARMONIC_VISUAL_TOKENS.color);
  });

  it('stands apart from the diatonic chord doing the same job only by the light', () => {
    expect(
      harmonicRoleVisuals([
        { function: 'subdominant', category: 'diatonic' } as unknown as ChordEvent,
      ]),
    ).toEqual([]);
    expect(harmonicRoleVisuals([borrowed('subdominant')])).toHaveLength(1);
  });
});

/**
 * The suggestion strip places borrowed chords too, so dropping the category on the way in made
 * the borrowing unreachable on any placed event.
 */
describe('a suggestion keeps where it came from', () => {
  const suggestion = (reason: SuggestionReason, fn: ChordFunction = 'subdominant') =>
    suggestionToChordEvent({
      rootOffset: 5,
      suffix: 'm',
      function: fn,
      degreeLabel: 'IVm',
      displayName: 'Fm',
      isPro: true,
      reason,
      score: 0.48,
    });

  /** The plain `F` of C major, for the cases that need a chord that is genuinely in the key. */
  const diatonicSuggestion = (reason: SuggestionReason) =>
    suggestionToChordEvent({
      rootOffset: 5,
      suffix: '',
      function: 'subdominant',
      degreeLabel: 'IV',
      displayName: 'F',
      isPro: false,
      reason,
      score: 0.6,
    });

  it.each<[SuggestionReason, string]>([
    ['modal', 'modalInterchange'],
    ['secondaryDominant', 'secondaryDominant'],
    ['minorDominant', 'primaryDominant'],
    ['functional', 'diatonic'],
    ['template', 'diatonic'],
    ['cadence', 'diatonic'],
    ['start', 'diatonic'],
  ])('carries %s through as %s', (reason, category) => {
    expect(suggestion(reason).category).toBe(category);
  });

  it('makes a borrowed chord placed from the strip reach the video as borrowed', () => {
    const placed = { id: 'x', ...suggestion('modal') } as ChordEvent;
    const [entry] = harmonicRoleVisuals([placed]);
    expect(entry).toBeDefined();
    expect(entry!.role).toBe('color');
  });

  it('leaves a diatonic suggestion on the untouched path', () => {
    const placed = { id: 'x', ...diatonicSuggestion('functional') } as ChordEvent;
    expect(harmonicRoleVisuals([placed], 'major')).toEqual([]);
  });

  /**
   * The `functional` reason marks the chord diatonic, and an `Fm` in a major song is not, so the
   * reason cannot be the last word. A missing technique means nothing was claimed, which leaves
   * the pitches free to say the chord is borrowed.
   */
  it('still hears a borrowed Fm that arrived labelled diatonic', () => {
    const placed = { id: 'x', ...suggestion('functional') } as ChordEvent;
    expect(harmonicRoleVisuals([placed], 'major')).toHaveLength(1);
    expect(harmonicRoleVisuals([placed], 'minor')).toEqual([]);
  });
});
