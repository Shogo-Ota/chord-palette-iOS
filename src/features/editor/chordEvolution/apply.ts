import {
  getSession,
  replaceProgressionAtomically,
  type EditorSession,
} from '@/features/editor/session';
import type { EvolutionCandidate } from '@/lib/harmony/evolution';

import {
  evolutionCandidateHasChanges,
  materializeEvolutionCandidateProgression,
  selectedIndexAfterEvolutionCandidate,
} from './candidateMaterializer';
import type { AtomicProgressionPatch, EvolutionAdapterResult, EvolutionApplyResult } from './types';

export function prepareEvolutionApply(
  session: Readonly<EditorSession>,
  candidate: EvolutionCandidate,
): EvolutionAdapterResult<AtomicProgressionPatch> {
  const materialized = materializeEvolutionCandidateProgression(session, candidate);
  if (!materialized.ok) return materialized;
  if (!evolutionCandidateHasChanges(candidate)) {
    return { ok: false, reason: 'NO_CHANGES' };
  }

  return {
    ok: true,
    value: {
      expectedCurrent: session.progression,
      progression: materialized.value,
      selected: selectedIndexAfterEvolutionCandidate(session.selected, candidate),
    },
  };
}

/**
 * Applies the complete candidate through exactly one Session transaction.
 * No selected-chord mutation API is used.
 */
export function applyEvolutionCandidate(candidate: EvolutionCandidate): EvolutionApplyResult {
  const session = getSession();
  const prepared = prepareEvolutionApply(session, candidate);
  if (!prepared.ok) {
    return {
      status: 'REJECTED',
      reason: prepared.reason,
      ...(prepared.detail ? { detail: prepared.detail } : {}),
    };
  }

  const applied = replaceProgressionAtomically(
    prepared.value.expectedCurrent,
    prepared.value.progression,
    prepared.value.selected,
  );
  return applied
    ? { status: 'APPLIED', historyEntriesAdded: 1 }
    : { status: 'REJECTED', reason: 'SESSION_CHANGED' };
}
