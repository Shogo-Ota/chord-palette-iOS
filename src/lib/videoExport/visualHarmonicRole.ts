import { passingDiminishedRuleForChordId } from '@/data/advancedHarmonyChords';
import type { PassingDiminishedKind } from '@/lib/musicTheory';
import type { ChordCategory, ChordEvent, ChordFunction } from '@/types';

/**
 * What a chord is *doing*, as the video should make a viewer feel it.
 *
 * A presentation classification, not a theory one. Nothing here decides a pitch, a
 * voicing or a duration; it decides a colour. The music domain keeps its own answer in
 * `ChordEvent.function`, and that answer is not changed to suit a video.
 *
 * The distinction matters most for a passing diminished. `G#dim7 → Am7` is stamped
 * `tonic` in the data, because it borrows the function of the chord it leads to, and a
 * library card is right to show that. On screen it is the opposite of restful: it is the
 * hardest pull in the progression. Both statements are true about different things, so
 * they get different colours rather than one being corrected into the other.
 */
export type VisualHarmonicRole =
  | 'stable'
  | 'motion'
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

/** Only what a placed chord already carries. No new theory is inferred. */
export interface VisualHarmonicInput {
  function?: ChordFunction;
  category?: ChordCategory;
  /** Library card id, which is how a chord's originating rule is recovered. */
  chordId?: string;
}

/**
 * Techniques whose whole purpose is the move they make, so the technique outranks the
 * function the chord happens to borrow.
 *
 * `modalInterchange` is deliberately absent. Borrowing from the parallel minor says
 * where a chord came from, not what force it applies: `Fm` in C is subdominant motion
 * and `B♭7` is a dominant pull, and flattening both into one colour would lose that.
 *
 * `passingDiminished` is absent for a different reason: the category is not specific
 * enough. A diminished seventh can be the dominant of the chord after it or a
 * voice-leading connector into it, and those two do not feel alike, so the rule behind
 * the card decides — see {@link ROLE_BY_DIMINISHED_KIND}.
 */
const ROLE_BY_TECHNIQUE: Partial<Record<ChordCategory, VisualHarmonicRole>> = {
  secondaryDominant: 'secondaryTension',
  substituteChord: 'tension',
  chromaticMediant: 'color',
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

const ROLE_BY_FUNCTION: Record<ChordFunction, VisualHarmonicRole> = {
  tonic: 'stable',
  subdominant: 'motion',
  dominant: 'tension',
};

/**
 * Categories that still say something once the function is missing.
 *
 * Knowing a chord was borrowed is real information — it is not the same as knowing
 * nothing — so a borrowed chord with no function reads as colour rather than falling
 * through to the unknown case. `diatonic`, `variation` and `slash` are absent because
 * without a function they genuinely say nothing about what the chord is doing.
 */
const ROLE_BY_CATEGORY_ALONE: Partial<Record<ChordCategory, VisualHarmonicRole>> = {
  modalInterchange: 'color',
};

/**
 * Resolve how a chord should read on screen.
 *
 * Technique first, function second. "What is this chord doing here" is a better guide to
 * how it should feel than "what chord is it", which is why a diminished seventh used as a
 * chromatic approach is not coloured like a diminished seventh in general.
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

  const byFunction = input.function ? ROLE_BY_FUNCTION[input.function] : undefined;
  if (byFunction) {
    // A borrowed chord reaches here on purpose, and lands on the force it applies.
    return { role: byFunction, confidence: input.category ? 'derived' : 'fallback' };
  }

  const byCategoryAlone = input.category ? ROLE_BY_CATEGORY_ALONE[input.category] : undefined;
  if (byCategoryAlone) return { role: byCategoryAlone, confidence: 'derived' };

  // Neither the technique nor the force is known, which is the only case neutral means.
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

export function visualHarmonicRoleFor(event: ChordEvent): VisualHarmonicVerdict {
  return resolveVisualHarmonicRole({
    function: event.function,
    category: event.category,
    chordId: event.chordId,
  });
}

/** Roles for one progression pass, in order. */
export function visualHarmonicRoles(progression: readonly ChordEvent[]): VisualHarmonicRole[] {
  return progression.map((event) => visualHarmonicRoleFor(event).role);
}
