import { harmonicRoleVisuals } from '@/lib/videoExport/harmonicRoleVisuals';
import {
  resolveVisualHarmonicRole,
  visualHarmonicRoles,
  type VisualHarmonicRole,
} from '@/lib/videoExport/visualHarmonicRole';
import { HARMONIC_VISUAL_TOKENS } from '@/theme/videoHarmonicTokens';
import { functionColor } from '@/theme/tokens';
import type { ChordCategory, ChordEvent, ChordFunction } from '@/types';

function role(input: { function?: ChordFunction; category?: ChordCategory }): VisualHarmonicRole {
  return resolveVisualHarmonicRole(input).role;
}

describe('what a chord is doing decides how it reads', () => {
  it.each<[string, { function?: ChordFunction; category?: ChordCategory }, VisualHarmonicRole]>([
    ['Cmaj7 as tonic', { function: 'tonic', category: 'diatonic' }, 'stable'],
    ['Fmaj7 as subdominant', { function: 'subdominant', category: 'diatonic' }, 'motion'],
    ['G7 as dominant', { function: 'dominant', category: 'diatonic' }, 'tension'],
    ['E7 → Am7', { function: 'dominant', category: 'secondaryDominant' }, 'secondaryTension'],
    ['G#dim7 → Am7', { function: 'tonic', category: 'passingDiminished' }, 'leadingTension'],
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
    expect(resolveVisualHarmonicRole({ category: 'passingDiminished' }).confidence).toBe('explicit');
    expect(
      resolveVisualHarmonicRole({ category: 'modalInterchange', function: 'subdominant' })
        .confidence,
    ).toBe('derived');
    expect(resolveVisualHarmonicRole({ function: 'tonic' }).confidence).toBe('fallback');
  });
});

/**
 * A passing diminished is the case the whole resolver exists for. The data layer stamps
 * `G#dim7 → Am7` as tonic, because it borrows the function of the chord it reaches, and a
 * library card is right to show that. On screen it is the hardest pull in the progression,
 * so the technique has to outrank the borrowed function.
 */
describe('technique outranks the function a chord borrows', () => {
  it('reads a passing diminished as a pull however its function is stamped', () => {
    for (const fn of ['tonic', 'subdominant', 'dominant'] as const) {
      expect(role({ function: fn, category: 'passingDiminished' })).toBe('leadingTension');
    }
  });

  it('never lets a passing diminished read as restful', () => {
    const verdict = resolveVisualHarmonicRole({
      function: 'tonic',
      category: 'passingDiminished',
    });
    expect(verdict.role).not.toBe('stable');
    expect(HARMONIC_VISUAL_TOKENS[verdict.role].main).not.toBe(functionColor.tonic);
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

  it('only reaches colour when no function is available at all', () => {
    expect(role({ category: 'modalInterchange' })).toBe('neutral');
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

describe('the palette handed to the renderer', () => {
  const event = (fn: ChordFunction, category?: ChordCategory): ChordEvent =>
    ({ function: fn, category }) as unknown as ChordEvent;

  it('carries one entry per progression position, in order', () => {
    const progression = [
      event('tonic', 'diatonic'),
      event('subdominant', 'diatonic'),
      event('dominant', 'diatonic'),
      event('tonic', 'passingDiminished'),
    ];
    expect(harmonicRoleVisuals(progression).map((entry) => [entry.cycleIndex, entry.role])).toEqual([
      [0, 'stable'],
      [1, 'motion'],
      [2, 'tension'],
      [3, 'leadingTension'],
    ]);
  });

  it('sends the token colours unchanged, so the renderer makes no colour decisions', () => {
    const [entry] = harmonicRoleVisuals([event('tonic', 'passingDiminished')]);
    expect(entry).toMatchObject(HARMONIC_VISUAL_TOKENS.leadingTension);
  });

  it('agrees with the role list used elsewhere', () => {
    const progression = [event('dominant', 'secondaryDominant'), event('tonic', 'diatonic')];
    expect(harmonicRoleVisuals(progression).map((entry) => entry.role)).toEqual(
      visualHarmonicRoles(progression),
    );
  });
});
