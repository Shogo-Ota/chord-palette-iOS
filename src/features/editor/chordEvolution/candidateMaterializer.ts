import type { EvolutionCandidate } from '@/lib/harmony/evolution';
import type { ChordEvent } from '@/types';

import {
  candidateHasChanges,
  materializeCandidateProgression,
  type EvolutionSessionProjection,
} from './chordEventAdapter';
import {
  materializeReharmCandidateProgression,
  selectedIndexAfterReharmCandidate,
} from './l3/reharmCandidateAdapter';
import type { EvolutionAdapterResult } from './types';

export function materializeEvolutionCandidateProgression(
  session: Readonly<EvolutionSessionProjection>,
  candidate: EvolutionCandidate,
): EvolutionAdapterResult<readonly ChordEvent[]> {
  return candidate.level === 'reharm'
    ? materializeReharmCandidateProgression(session, candidate)
    : materializeCandidateProgression(session, candidate);
}

export function evolutionCandidateHasChanges(candidate: EvolutionCandidate): boolean {
  return candidate.level === 'reharm'
    ? candidate.changes.length > 0
    : candidateHasChanges(candidate);
}

export function selectedIndexAfterEvolutionCandidate(
  selected: number,
  candidate: EvolutionCandidate,
): number {
  return candidate.level === 'reharm'
    ? selectedIndexAfterReharmCandidate(selected, candidate)
    : selected;
}
