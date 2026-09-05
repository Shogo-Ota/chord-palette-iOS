import { sessionToPlaybackRequest } from '@/features/editor/playback';
import type { EditorSession } from '@/features/editor/session';
import type { EvolutionCandidate } from '@/lib/harmony/evolution';
import type { Tier } from '@/lib/performance/tier';
import type { PlaybackRequest } from '@/services/audio/types';

import { materializeCandidateProgression } from './chordEventAdapter';
import type { EvolutionAdapterResult } from './types';

/**
 * Builds a normal production PlaybackRequest from an isolated candidate
 * progression. It does not write to the Editor Session or invoke AudioService.
 */
export function buildEvolutionPreviewRequest(
  session: Readonly<EditorSession>,
  candidate: EvolutionCandidate,
  tier: Tier = 'free',
): EvolutionAdapterResult<PlaybackRequest> {
  const materialized = materializeCandidateProgression(session, candidate);
  if (!materialized.ok) return materialized;

  const playbackSession: EditorSession = {
    ...session,
    progression: materialized.value.map((event) => ({
      ...event,
      ...(event.rootSpelling ? { rootSpelling: { ...event.rootSpelling } } : {}),
    })),
  };
  return {
    ok: true,
    value: sessionToPlaybackRequest(playbackSession, false, tier),
  };
}
