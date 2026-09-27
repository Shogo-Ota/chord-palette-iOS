import type { VisualHarmonicRole } from '@/lib/videoExport/visualHarmonicRole';
import type { ChordCategory } from '@/types';

/**
 * Which family of light paints a chord, which is not always the same as what the chord is doing.
 *
 * The role answers "what force is this". The family answers "what colour says so". They agree
 * for most techniques, and keeping them as one type would be simpler — but it would also make
 * one unfixable. A tritone substitute applies a dominant pull, so its role is `tension`; its
 * body is therefore already dominant red, and a red light over a red body leaves nothing but a
 * rim to tell it from an ordinary `G7`. The pull and the substitution are two facts, and the
 * second one needs a colour the first is not already using.
 *
 * So the families are a superset of the roles: every role has one of its own, plus the cases
 * that need a colour their role cannot give them.
 */
export type VisualAccentFamily = VisualHarmonicRole | 'substitute';

/**
 * Techniques whose light is chosen for them rather than taken from their role.
 *
 * Deliberately small. An entry here is a claim that a role's colour would be unreadable on the
 * function colour underneath it, which is true of the dominant substitutes and not of much else:
 * `E♭dim7` also lands amber on amber, but it is a connector rather than a second reading of the
 * same chord, and its brightness carries it.
 */
const FAMILY_BY_CATEGORY: Partial<Record<ChordCategory, VisualAccentFamily>> = {
  // Cyan for the alternate route to the tonic. Red stays the property of the function itself.
  substituteChord: 'substitute',
};

export function visualAccentFamilyFor(
  role: VisualHarmonicRole,
  category: ChordCategory | undefined,
): VisualAccentFamily {
  return (category ? FAMILY_BY_CATEGORY[category] : undefined) ?? role;
}
