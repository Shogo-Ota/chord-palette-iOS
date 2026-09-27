import { passingDiminishedRuleForChordId } from '@/data/advancedHarmonyChords';
import { chordPitchClasses } from '@/data/chordPitchClassSet';
import { MINOR_SCALE_OFFSETS } from '@/data/minorMode';
import { MAJOR_SCALE_OFFSETS } from '@/data/music';
import type { PassingDiminishedKind } from '@/lib/musicTheory';
import type { ChordCategory, ChordEvent, KeyMode } from '@/types';

/**
 * What kind of special a chord is, as the video should make a viewer feel it.
 *
 * A presentation classification, not a theory one. Nothing here decides a pitch, a
 * voicing or a duration; it decides the colour of the *light* around a chord. The body of
 * the glyph is painted from `ChordEvent.function` through the legacy T/SD/D colours, and this
 * role never overrides it. The two carry different facts on purpose: the fill says what force
 * the chord applies, the light says why it is worth noticing.
 *
 * That split is why no role names an ordinary tonic or subdominant. An ordinary chord gets no
 * light at all — it sends no palette entry and renders exactly as Flow always did — so a role
 * meaning "this is a plain subdominant" would have nothing left to describe.
 *
 * The distinction matters most for a passing diminished. `G#dim7 → Am7` is stamped `tonic` in
 * the data, because it borrows the function of the chord it leads to, and a library card is
 * right to show that. Its light is nonetheless the hardest pull in the progression. Both
 * statements are true about different things, so they live in different places rather than one
 * being corrected into the other.
 */
export type VisualHarmonicRole =
  | 'tension'
  | 'secondaryTension'
  | 'leadingTension'
  | 'color'
  | 'transition'
  | 'neutral';

/** How the role was reached, so a caller can tell a decision from a fallback. */
export type VisualHarmonicConfidence = 'explicit' | 'derived' | 'fallback';

export interface VisualHarmonicVerdict {
  role: VisualHarmonicRole;
  confidence: VisualHarmonicConfidence;
}

/**
 * Only what a placed chord already carries. No new theory is inferred.
 *
 * `function` is deliberately absent: it paints the glyph body, and deriving the light from it
 * as well would say the same thing twice while adding a second hue that fights the first.
 */
export interface VisualHarmonicInput {
  category?: ChordCategory;
  /** Library card id, which is how a chord's originating rule is recovered. */
  chordId?: string;
}

/**
 * The technique a chord announces, which is the whole of what its light says.
 *
 * `modalInterchange` reads as colour rather than as the force it applies. The force is already
 * on screen in the fill — a borrowed `Fm` is painted subdominant amber, the same as the `F`
 * beside it — so the light is free to carry the one thing the fill cannot: that this chord came
 * from outside the key.
 *
 * `passingDiminished` is absent because the category is not specific enough. A diminished
 * seventh can be the dominant of the chord after it or a voice-leading connector into it, and
 * those two do not feel alike, so the rule behind the card decides — see
 * {@link ROLE_BY_DIMINISHED_KIND}.
 */
const ROLE_BY_TECHNIQUE: Partial<Record<ChordCategory, VisualHarmonicRole>> = {
  secondaryDominant: 'secondaryTension',
  substituteChord: 'tension',
  chromaticMediant: 'color',
  modalInterchange: 'color',
  augmentedTriad: 'transition',
};

/**
 * How each kind of diminished seventh reads.
 *
 * A secondary leading-tone diminished is a rootless dominant with a flat ninth, so it
 * belongs with the tension family. A chromatic passing diminished holds common tones and
 * slides the rest by a semitone into the next chord, which is the same thing an augmented
 * connector does — a connector, not a demand — so it shares `transition`.
 */
const ROLE_BY_DIMINISHED_KIND: Record<PassingDiminishedKind, VisualHarmonicRole> = {
  secondaryLeadingTone: 'leadingTension',
  chromaticPassing: 'transition',
};

/**
 * Resolve what kind of light a chord gets.
 *
 * The technique decides, and nothing else does. A chord announcing no technique reaches
 * `neutral`, which the caller drops rather than draws, so it keeps Flow's original
 * presentation instead of being tinted by a guess.
 */
export function resolveVisualHarmonicRole(input: VisualHarmonicInput): VisualHarmonicVerdict {
  if (input.category === 'passingDiminished') {
    // No implicit tension: a diminished seventh whose rule cannot be recovered has not
    // told us what it is doing, and guessing the loudest answer would be the worst one.
    const kind = passingDiminishedRuleForChordId(input.chordId)?.kind;
    return kind
      ? { role: ROLE_BY_DIMINISHED_KIND[kind], confidence: 'explicit' }
      : { role: 'neutral', confidence: 'fallback' };
  }

  const byTechnique = input.category ? ROLE_BY_TECHNIQUE[input.category] : undefined;
  if (byTechnique) return { role: byTechnique, confidence: 'explicit' };

  // No technique was announced, which is the only case neutral means.
  return { role: 'neutral', confidence: 'fallback' };
}

/**
 * Categories the video treats as advanced harmony.
 *
 * Only these get role colour and the extra light that goes with it. Everything else — a
 * diatonic chord, a decorated one, a slash chord — renders exactly as Flow always did,
 * because marking every chord as special marks none of them.
 */
const ROLE_STYLED_CATEGORIES: readonly ChordCategory[] = [
  'passingDiminished',
  'secondaryDominant',
  'substituteChord',
  'chromaticMediant',
  'modalInterchange',
  'augmentedTriad',
];

export function isRoleStyledChord(event: ChordEvent): boolean {
  return event.category != null && ROLE_STYLED_CATEGORIES.includes(event.category);
}

const MAJOR = new Set<number>(MAJOR_SCALE_OFFSETS as readonly number[]);
const PARALLEL_MINOR = new Set<number>(MINOR_SCALE_OFFSETS);

/**
 * Whether a chord with no stated technique is borrowed from the parallel minor.
 *
 * Two conditions, both required: it leaves the major scale, and it stays entirely inside the
 * parallel natural minor. That pair is not a heuristic — it is what borrowing from the
 * parallel minor means — and it is why the other techniques do not get caught by it. `E7`
 * brings a G# and `G#dim7` brings a B, neither of which the parallel minor contains, so they
 * fall through to their own categories.
 *
 * Pitch classes are counted from the tonic, so this needs no key name. Only major contexts are
 * inferred: in a minor key the major V is the standard dominant rather than a borrowing, and
 * reading parallel-major membership as borrowing there would misclassify it. That direction is
 * left for its own phase.
 */
function isBorrowedFromParallelMinor(event: ChordEvent, harmonicMode: KeyMode): boolean {
  if (harmonicMode !== 'major') return false;
  const sounding = chordPitchClasses({
    rootOffset: event.rootOffset ?? 0,
    suffix: event.suffix ?? '',
    definitionId: event.definitionId,
  });
  if (event.bassOffset != null) sounding.push(((event.bassOffset % 12) + 12) % 12);
  const pitches = [...new Set(sounding)];
  return (
    pitches.some((pitch) => !MAJOR.has(pitch)) && pitches.every((pitch) => PARALLEL_MINOR.has(pitch))
  );
}

/**
 * How a chord should read, given the mode the song is in.
 *
 * A stated technique always wins. `B♭7` is the backdoor dominant and `E♭maj7` is a chromatic
 * mediant, and both happen to sit inside the parallel minor, so inferring borrowing from their
 * pitches would overwrite what the player actually chose.
 */
export function visualHarmonicRoleInContext(
  event: ChordEvent,
  harmonicMode: KeyMode,
): VisualHarmonicVerdict {
  const stated = visualHarmonicRoleFor(event);
  if (stated.confidence === 'explicit' || isRoleStyledChord(event)) return stated;
  if (!isBorrowedFromParallelMinor(event, harmonicMode)) return stated;
  // The same reading a chord gets when it names the borrowing itself, which is the point: the
  // palette a chord was taken from cannot change how it looks.
  return { role: 'color', confidence: 'derived' };
}

export function isBorrowedInContext(event: ChordEvent, harmonicMode: KeyMode): boolean {
  if (isRoleStyledChord(event)) return false;
  return isBorrowedFromParallelMinor(event, harmonicMode);
}

export function visualHarmonicRoleFor(event: ChordEvent): VisualHarmonicVerdict {
  return resolveVisualHarmonicRole({ category: event.category, chordId: event.chordId });
}

/** Roles for one progression pass, in order. */
export function visualHarmonicRoles(progression: readonly ChordEvent[]): VisualHarmonicRole[] {
  return progression.map((event) => visualHarmonicRoleFor(event).role);
}
