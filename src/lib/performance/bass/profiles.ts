/**
 * Bass movement profiles per rhythm (implementation_v1.01 Phase 7).
 *
 * Deliberately conservative: the two textures (block / arpeggio) keep today's
 * root-only bass — their bass is sparse and the stillness is the point — while
 * the moving rhythms get root–fifth alternation and the driving ones add the
 * octave pump. Approach notes appear more the more forward-leaning the rhythm
 * is. The ballad feel (`relaxed`) warmed up in Ballad Engine v1: mostly root,
 * with the odd drop to the fifth late in a chord (ballad_engine_spec §4). An id
 * outside this table (legacy direct styles, fixtures) resolves to root-only,
 * i.e. EXACTLY the pre-v1.01 sound.
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

/**
 * Ballad Engine v1 (ballad_engine_spec §4 BALLAD_WARM): roughly half the chords
 * stay home on the root, the other half drop to the fifth on the weak strike.
 * Approach kept rare — and the planner's 1-beat guard suppresses it entirely on
 * this feel's sparse half-bar grid — so the stillness survives the movement.
 */
const BALLAD_WARM: BassProfile = {
  figures: ['rootFifth', 'rootOnly'],
  approachChance: 0.15,
  passing: false,
};

/** Root–fifth (sometimes staying home) with regular approach pushes (pop/band). */
const POP_LINE: BassProfile = {
  figures: ['rootFifth', 'rootOnly'],
  approachChance: 0.5,
  passing: true,
};

/**
 * Band Engine v1 (band_engine_spec §4 BAND_MOVE): the pop line plus an
 * occasional octave pump for the サビ-like lift, connectives on the change.
 */
const BAND_LINE: BassProfile = {
  figures: ['rootFifth', 'rootOnly', 'rootOctave'],
  approachChance: 0.5,
  passing: true,
};

/** Octave pump joins the pool; approaches lead almost every change (drive). */
const DRIVE_LINE: BassProfile = {
  figures: ['rootOctave', 'rootFifth'],
  approachChance: 0.6,
  passing: true,
};

/**
 * City Engine v1 (city_engine_spec §4 CITY_SMOOTH): the 16-beat bass sings
 * instead of pumping — fifths over octave jumps, connectives kept moderate,
 * so the line reads 滑らか rather than driving.
 */
const CITY_LINE: BassProfile = {
  figures: ['rootFifth', 'rootOnly'],
  approachChance: 0.4,
  passing: true,
};

const PROFILE_OF: Record<string, BassProfile> = {
  block: ROOT_ONLY,
  arpeggio: ROOT_ONLY,
  relaxed: BALLAD_WARM,
  sixEight: BALLAD_LINE,
  waltz: BALLAD_LINE,
  bossa: BALLAD_LINE,
  natural: POP_LINE,
  beat8: BAND_LINE,
  shuffle: POP_LINE,
  swing: POP_LINE,
  reggae: POP_LINE,
  driving: DRIVE_LINE,
  beat16: CITY_LINE,
};

/** The movement profile a rhythm id plays with (unknown ids stay root-only). */
export function bassProfileFor(styleId: string): BassProfile {
  return PROFILE_OF[styleId] ?? ROOT_ONLY;
}
