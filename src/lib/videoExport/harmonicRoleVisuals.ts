import { harmonicVisualToken } from '@/theme/videoHarmonicTokens';
import type { HarmonicRoleVisual } from '@/services/videoExport/types';
import {
  isBorrowedInContext,
  isRoleStyledChord,
  visualHarmonicRoleInContext,
} from '@/lib/videoExport/visualHarmonicRole';
import type { ChordEvent, KeyMode } from '@/types';

/**
 * The role palette for one progression pass, ready to hand to the renderer.
 *
 * Only advanced-harmony positions get an entry — either because the chord states a technique,
 * or because, in a major context, its notes are outside the major scale and entirely inside the
 * parallel minor, which is what borrowing from the parallel minor is. Where the chord came from
 * in the UI does not enter into it: the same `Fm` in the same C major song reads the same way
 * whether it was taken from the minor grid or from the borrowed-chord row.
 * A position with no entry falls back to the
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
export function harmonicRoleVisuals(
  progression: readonly ChordEvent[],
  harmonicMode: KeyMode = 'major',
): HarmonicRoleVisual[] {
  return progression.reduce<HarmonicRoleVisual[]>((entries, event, cycleIndex) => {
    if (!isRoleStyledChord(event) && !isBorrowedInContext(event, harmonicMode)) return entries;
    const { role } = visualHarmonicRoleInContext(event, harmonicMode);
    // A chord that reached `neutral` has told us nothing, so it gets the same untouched
    // presentation as a diatonic one instead of a colour standing in for an answer.
    if (role === 'neutral') return entries;
    entries.push({ cycleIndex, role, ...harmonicVisualToken(role) });
    return entries;
  }, []);
}
