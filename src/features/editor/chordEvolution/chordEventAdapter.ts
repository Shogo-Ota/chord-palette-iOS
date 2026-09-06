import type { EditorSession } from '@/features/editor/session';
import type {
  EvolutionCandidate,
  EvolutionChord,
  EvolutionContext,
  EvolutionLevel,
  EvolutionScope,
} from '@/lib/harmony/evolution';
import { transposeEvent } from '@/lib/transpose';
import type { ChordEvent } from '@/types';

import type {
  EvolutionAdapterFailure,
  EvolutionAdapterFailureReason,
  EvolutionAdapterResult,
} from './types';
import { validateCandidateShape } from './candidateShapePolicy';

export type EvolutionSessionProjection = Pick<EditorSession, 'key' | 'mode' | 'progression'>;

function fail(reason: EvolutionAdapterFailureReason, detail?: string): EvolutionAdapterFailure {
  return {
    ok: false,
    reason,
    ...(detail ? { detail } : {}),
  };
}

function copyEvent(event: ChordEvent): ChordEvent {
  return {
    ...event,
    ...(event.rootSpelling ? { rootSpelling: { ...event.rootSpelling } } : {}),
  };
}

function rootSpellingEquals(
  left: EvolutionChord['symbol']['rootSpelling'],
  right: EvolutionChord['symbol']['rootSpelling'],
): boolean {
  return (
    left === right ||
    (left != null &&
      right != null &&
      left.degreeIndex === right.degreeIndex &&
      left.alteration === right.alteration)
  );
}

function localContextEquals(
  left: EvolutionChord['localHarmonicContext'],
  right: EvolutionChord['localHarmonicContext'],
): boolean {
  return (
    left === right ||
    (left != null &&
      right != null &&
      left.kind === right.kind &&
      left.tonic === right.tonic &&
      left.mode === right.mode)
  );
}

export function evolutionChordsEqual(left: EvolutionChord, right: EvolutionChord): boolean {
  return (
    left.eventId === right.eventId &&
    left.chordId === right.chordId &&
    left.function === right.function &&
    left.durationBeats === right.durationBeats &&
    left.voicingPosition === right.voicingPosition &&
    left.symbol.rootOffset === right.symbol.rootOffset &&
    left.symbol.suffix === right.symbol.suffix &&
    left.symbol.definitionId === right.symbol.definitionId &&
    left.symbol.bassOffset === right.symbol.bassOffset &&
    rootSpellingEquals(left.symbol.rootSpelling, right.symbol.rootSpelling) &&
    localContextEquals(left.localHarmonicContext, right.localHarmonicContext)
  );
}

/**
 * Feature-layer projection. `keyContext` and `modeContext` deliberately do not
 * become local harmonic context because current events receive them implicitly.
 */
export function chordEventToEvolutionChord(event: ChordEvent): EvolutionChord {
  return {
    eventId: event.id,
    chordId: event.chordId,
    symbol: {
      rootOffset: event.rootOffset,
      suffix: event.suffix,
      ...(event.definitionId ? { definitionId: event.definitionId } : {}),
      ...(event.rootSpelling ? { rootSpelling: { ...event.rootSpelling } } : {}),
      ...(event.bassOffset == null ? {} : { bassOffset: event.bassOffset }),
    },
    function: event.function,
    durationBeats: event.durationBeats,
    ...(event.voicingPosition ? { voicingPosition: event.voicingPosition } : {}),
  };
}

export function sessionToEvolutionContext(
  session: EvolutionSessionProjection,
  scope: EvolutionScope,
  level: EvolutionLevel,
): EvolutionContext {
  return {
    tonic: session.key,
    mode: session.mode,
    progression: session.progression.map(chordEventToEvolutionChord),
    scope: scope.kind === 'chord' ? { kind: 'chord', index: scope.index } : { kind: 'progression' },
    level,
  };
}

function totalBeats(progression: readonly EvolutionChord[]): number {
  return progression.reduce((sum, chord) => sum + chord.durationBeats, 0);
}

function changedIndices(candidate: EvolutionCandidate): readonly number[] {
  return candidate.before.flatMap((before, index) => {
    const after = candidate.after[index];
    return after && !evolutionChordsEqual(before, after) ? [index] : [];
  });
}

function validateChangeSet(candidate: EvolutionCandidate): EvolutionAdapterFailure | null {
  const replacementIndices = new Set<number>();

  for (const change of candidate.changes) {
    if (change.kind !== 'replace') {
      return fail('UNSUPPORTED_CHANGE_KIND', 'Phase 2 accepts replacement-only candidates.');
    }
    if (
      replacementIndices.has(change.index) ||
      !candidate.before[change.index] ||
      !candidate.after[change.index] ||
      !evolutionChordsEqual(change.before, candidate.before[change.index]!) ||
      !evolutionChordsEqual(change.after, candidate.after[change.index]!)
    ) {
      return fail('INVALID_CHANGE_SET');
    }
    replacementIndices.add(change.index);
  }

  const expected = changedIndices(candidate);
  if (
    expected.length !== replacementIndices.size ||
    expected.some((index) => !replacementIndices.has(index))
  ) {
    return fail('INVALID_CHANGE_SET');
  }
  return null;
}

function validateCandidate(
  session: EvolutionSessionProjection,
  candidate: EvolutionCandidate,
): EvolutionAdapterFailure | null {
  const current = session.progression.map(chordEventToEvolutionChord);
  if (
    candidate.before.length !== current.length ||
    candidate.before.some(
      (chord, index) => !current[index] || !evolutionChordsEqual(chord, current[index]!),
    )
  ) {
    return fail('STALE_BASELINE');
  }

  if (candidate.after.length !== candidate.before.length) {
    return fail('LENGTH_CHANGED');
  }

  const knownIds = new Set(candidate.before.map((chord) => chord.eventId));
  for (const after of candidate.after) {
    if (!knownIds.has(after.eventId)) {
      return fail('UNKNOWN_EVENT_ID', after.eventId);
    }
  }
  if (candidate.after.some((after, index) => after.eventId !== candidate.before[index]?.eventId)) {
    return fail('EVENT_ORDER_CHANGED');
  }

  if (totalBeats(candidate.after) !== totalBeats(candidate.before)) {
    return fail('TOTAL_BEATS_CHANGED');
  }
  if (
    candidate.after.some(
      (after, index) => after.durationBeats !== candidate.before[index]?.durationBeats,
    )
  ) {
    return fail('DURATION_CHANGED');
  }
  const shape = validateCandidateShape(candidate);
  if (!shape.supported) {
    return fail(
      shape.detail.startsWith('Unsupported') ? 'UNSUPPORTED_CANDIDATE' : 'INVALID_CHANGE_SET',
      shape.detail,
    );
  }

  return validateChangeSet(candidate);
}

function materializeChord(
  source: ChordEvent,
  before: EvolutionChord,
  after: EvolutionChord,
  session: Pick<EvolutionSessionProjection, 'key' | 'mode'>,
): ChordEvent {
  if (evolutionChordsEqual(before, after)) return copyEvent(source);

  const changed: ChordEvent = {
    ...copyEvent(source),
    id: after.eventId,
    chordId: after.chordId,
    function: after.function,
    durationBeats: after.durationBeats,
    rootOffset: after.symbol.rootOffset,
    suffix: after.symbol.suffix,
    definitionId: after.symbol.definitionId,
    rootSpelling: after.symbol.rootSpelling ? { ...after.symbol.rootSpelling } : undefined,
    bassOffset: after.symbol.bassOffset,
    bassNote: after.symbol.bassOffset == null ? undefined : source.bassNote,
    voicingPosition: after.voicingPosition,
  };
  return transposeEvent(changed, session.key, session.mode);
}

export function materializeCandidateProgression(
  session: EvolutionSessionProjection,
  candidate: EvolutionCandidate,
): EvolutionAdapterResult<readonly ChordEvent[]> {
  const invalid = validateCandidate(session, candidate);
  if (invalid) return invalid;

  return {
    ok: true,
    value: candidate.after.map((after, index) =>
      materializeChord(session.progression[index]!, candidate.before[index]!, after, session),
    ),
  };
}

export function candidateHasChanges(candidate: EvolutionCandidate): boolean {
  return changedIndices(candidate).length > 0;
}
