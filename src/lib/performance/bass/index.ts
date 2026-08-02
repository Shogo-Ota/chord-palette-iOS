/** Bass-line planner — public API (implementation_v1.01 Phase 7). */

export type { BassFigure, BassProfile } from './types';
export { bassProfileFor, ROOT_ONLY } from './profiles';
export { planBassLine, type BassPlanInput, type ChordTones } from './planBassLine';
