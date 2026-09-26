import { harmonicVisualToken } from '@/theme/videoHarmonicTokens';
import type { HarmonicRoleVisual } from '@/services/videoExport/types';
import { resolveVisualHarmonicRole } from '@/lib/videoExport/visualHarmonicRole';
import type { ChordEvent } from '@/types';

/**
 * The role palette for one progression pass, ready to hand to the renderer.
 *
 * Built once per export rather than per frame: the progression does not change while a
 * video is encoding, and a 60-second render draws the same positions 4× over.
 */
export function harmonicRoleVisuals(progression: readonly ChordEvent[]): HarmonicRoleVisual[] {
  return progression.map((event, cycleIndex) => {
    const { role } = resolveVisualHarmonicRole({
      function: event.function,
      category: event.category,
    });
    const token = harmonicVisualToken(role);
    return { cycleIndex, role, ...token };
  });
}
