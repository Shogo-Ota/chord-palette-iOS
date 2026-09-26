import { borrowedVisualToken, harmonicVisualToken } from '@/theme/videoHarmonicTokens';
import type { HarmonicRoleVisual } from '@/services/videoExport/types';
import { isRoleStyledChord, visualHarmonicRoleFor } from '@/lib/videoExport/visualHarmonicRole';
import type { ChordEvent } from '@/types';

/**
 * The role palette for one progression pass, ready to hand to the renderer.
 *
 * Only advanced-harmony positions get an entry. A position with no entry falls back to the
 * segment's own colour and to Flow's original presentation, so a diatonic chord is not
 * merely a different colour from before — it is byte-identical to before. That matters:
 * lighting every chord marks none of them, and the point of the palette is that a
 * borrowed, substituted or chromatic chord stands out from its neighbours.
 *
 * A fully diatonic progression therefore returns an empty list, and the caller drops the
 * sidecar entirely rather than sending one that says nothing.
 *
 * Built once per export: the progression does not change while a video encodes, and a
 * 60-second render draws the same positions several times over.
 */
export function harmonicRoleVisuals(progression: readonly ChordEvent[]): HarmonicRoleVisual[] {
  return progression.reduce<HarmonicRoleVisual[]>((entries, event, cycleIndex) => {
    if (!isRoleStyledChord(event)) return entries;
    const { role } = visualHarmonicRoleFor(event);
    // A chord that reached `neutral` has told us nothing, so it gets the same untouched
    // presentation as a diatonic one instead of a colour standing in for an answer.
    if (role === 'neutral') return entries;
    // A borrowed chord keeps the colour of the function it performs; the light alone says
    // it was borrowed. Every other technique replaces the function colour outright.
    const token =
      event.category === 'modalInterchange' && event.function
        ? borrowedVisualToken(event.function)
        : harmonicVisualToken(role);
    entries.push({ cycleIndex, role, ...token });
    return entries;
  }, []);
}
