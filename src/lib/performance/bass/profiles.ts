/**
 * Bass movement profiles per rhythm (implementation_v1.01 Phase 7).
 *
 * Deliberately conservative: the two textures (block / arpeggio) and the ballad
 * feel keep today's root-only bass — their bass is sparse and the stillness is
 * the point — while the moving rhythms get root–fifth alternation and the driving
 * ones add the octave pump. Approach notes appear more the more forward-leaning
 * the rhythm is. An id outside this table (legacy direct styles, fixtures)
 * resolves to root-only, i.e. EXACTLY the pre-v1.01 sound.
 */

import type { BassProfile } from './types';

/** Root only — bit-identical to the pre-planner bass. */
export const ROOT_ONLY: BassProfile = {
  figures: ['rootOnly'],
  approachChance: 0,
  passing: false,
};

/** Gentle root–fifth with an occasional connective (ballad-side rhythms). */
const BALLAD_LINE: BassProfile = {
  figures: ['rootFifth'],
  approachChance: 0.3,
  passing: true,
};

/** Root–fifth (sometimes staying home) with regular approach pushes (pop/band). */
const POP_LINE: BassProfile = {
  figures: ['rootFifth', 'rootOnly'],
  approachChance: 0.5,
  passing: true,
};

/** Octave pump joins the pool; approaches lead almost every change (drive). */
const DRIVE_LINE: BassProfile = {
  figures: ['rootOctave', 'rootFifth'],
  approachChance: 0.6,
  passing: true,
};

const PROFILE_OF: Record<string, BassProfile> = {
  block: ROOT_ONLY,
  arpeggio: ROOT_ONLY,
  relaxed: ROOT_ONLY,
  sixEight: BALLAD_LINE,
  waltz: BALLAD_LINE,
  bossa: BALLAD_LINE,
  natural: POP_LINE,
  beat8: POP_LINE,
  shuffle: POP_LINE,
  swing: POP_LINE,
  reggae: POP_LINE,
  driving: DRIVE_LINE,
  beat16: DRIVE_LINE,
};

/** The movement profile a rhythm id plays with (unknown ids stay root-only). */
export function bassProfileFor(styleId: string): BassProfile {
  return PROFILE_OF[styleId] ?? ROOT_ONLY;
}
