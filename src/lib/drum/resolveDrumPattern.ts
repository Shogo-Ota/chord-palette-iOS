/**
 * Which native drum kit plays, given the drum controls the user actually has.
 *
 * Clap mode is always the backbeat clap kit — no subdivision, no extra takes.
 * Full mode picks 8-beat / 16-beat / triplet. Rhythms that own their meter or hop
 * (waltz, 6/8, shuffle, swing, reggae) keep theirs under Full, so a 4/4 kit
 * never wraps under a waltz.
 */

import { drumPatternFor } from '@/lib/performance/rhythms';

import { DEFAULT_DRUM_BEAT, type DrumBeat } from './drumBeat';
import type { DrumMode } from './drumMode';

/** Full-mode subdivision → native groove id. Triplet reuses the swung-hat kit. */
const BEAT_GROOVE: Record<DrumBeat, string> = {
  '8': 'pop8',
  '16': 'pop16',
  '3': 'shuffle',
};

export type DrumPatternRequest = {
  grooveId: string;
  accompanimentPattern: string;
  drumBeat?: DrumBeat;
  drumMode?: DrumMode;
};

export function resolveDrumPatternId(request: DrumPatternRequest): string {
  if (request.drumMode === 'clap') return 'clap';
  const owned = drumPatternFor(request.grooveId, request.accompanimentPattern);
  if (owned !== request.grooveId) return owned;
  return BEAT_GROOVE[request.drumBeat ?? DEFAULT_DRUM_BEAT];
}
