import { harmonicRoleVisuals } from '@/lib/videoExport/harmonicRoleVisuals';
import { visualAccentFamilyFor } from '@/lib/videoExport/visualAccentFamily';
import { HARMONIC_VISUAL_TOKENS } from '@/theme/videoHarmonicTokens';
import { functionColor } from '@/theme/tokens';
import type { ChordCategory, ChordEvent, ChordFunction } from '@/types';

function chord(category: ChordCategory | undefined, fn: ChordFunction, chordId?: string): ChordEvent {
  return { function: fn, category, chordId } as unknown as ChordEvent;
}

/** `D♭7` and `B♭7`, the two cards in the substitute group. Both are dominants. */
const substitutes = [chord('substituteChord', 'dominant'), chord('substituteChord', 'subdominant')];

describe('the light a chord gets is not always its role own colour', () => {
  it('leaves every other technique on its role colour', () => {
    const asIs: [ChordCategory | undefined, ChordFunction][] = [
      ['secondaryDominant', 'dominant'],
      ['passingDiminished', 'dominant'],
      ['chromaticMediant', 'tonic'],
      ['modalInterchange', 'subdominant'],
      ['augmentedTriad', 'tonic'],
      ['diatonic', 'tonic'],
      [undefined, 'tonic'],
    ];
    for (const [category] of asIs) {
      expect(visualAccentFamilyFor('tension', category)).toBe('tension');
      expect(visualAccentFamilyFor('color', category)).toBe('color');
    }
  });

  it('sends a substitute to its own family whatever its role', () => {
    for (const role of ['tension', 'secondaryTension', 'transition'] as const) {
      expect(visualAccentFamilyFor(role, 'substituteChord')).toBe('substitute');
    }
  });
});

describe('a substituted dominant is red underneath and cyan on top', () => {
  it('keeps the tension role, because the pull is real', () => {
    for (const event of substitutes) {
      expect(harmonicRoleVisuals([event])[0]!.role).toBe('tension');
    }
  });

  it('paints its light cyan rather than the red its role would give it', () => {
    for (const event of substitutes) {
      const [entry] = harmonicRoleVisuals([event]);
      expect(entry).toMatchObject(HARMONIC_VISUAL_TOKENS.substitute);
      expect(entry!.outline).toBe('#67e8f9');
      expect(entry!.glowCore).toBe('#a5f3fc');
      expect(entry!.glowOuter).toBe('#22d3ee');
    }
  });

  /**
   * The rail dot and the dim degree label both take the accent, so one value covers the two
   * places the substitution is marked outside the glyph itself.
   */
  it('marks the rail with the same cyan', () => {
    expect(harmonicRoleVisuals([substitutes[0]!])[0]!.accent).toBe('#22d3ee');
  });

  /**
   * The acceptance case: `G7` and `B♭7` are both dominants, so both are filled red, and the
   * viewer has to be able to see that only one of them is a substitute.
   */
  it('is tellable from an ordinary dominant, which sends no light at all', () => {
    expect(harmonicRoleVisuals([chord('diatonic', 'dominant')])).toEqual([]);
    expect(harmonicRoleVisuals([substitutes[0]!])).toHaveLength(1);
  });

  it('shares no colour with the red its body is filled with', () => {
    const body = functionColor.dominant;
    for (const layer of ['accent', 'outline', 'glowCore', 'glowOuter'] as const) {
      expect(HARMONIC_VISUAL_TOKENS.substitute[layer]).not.toBe(body);
      // Cyan against red: the two are opposite enough that no channel ordering is shared.
      expect(HARMONIC_VISUAL_TOKENS.substitute[layer]).not.toBe(
        HARMONIC_VISUAL_TOKENS.tension[layer],
      );
    }
  });
});

/** The four techniques the user asked to leave alone have to come out byte-identical. */
describe('nothing else moved', () => {
  it.each<[string, ChordCategory, ChordFunction, string, string]>([
    ['E♭dim7', 'passingDiminished', 'subdominant', 'transition', 'passing-diminished-C-flat-three-to-two'],
    ['G#dim7', 'passingDiminished', 'dominant', 'leadingTension', 'passing-diminished-C-sharp-five-to-six'],
  ])('leaves %s on %s', (_name, category, fn, family, chordId) => {
    const [entry] = harmonicRoleVisuals([chord(category, fn, chordId)]);
    expect(entry).toMatchObject(
      HARMONIC_VISUAL_TOKENS[family as keyof typeof HARMONIC_VISUAL_TOKENS],
    );
  });

  it.each<[string, ChordCategory, ChordFunction]>([
    ['Fm', 'modalInterchange', 'subdominant'],
    ['E♭maj7', 'chromaticMediant', 'tonic'],
  ])('leaves %s on the borrowed-colour family', (_name, category, fn) => {
    const [entry] = harmonicRoleVisuals([chord(category, fn)]);
    expect(entry).toMatchObject(HARMONIC_VISUAL_TOKENS.color);
  });
});
