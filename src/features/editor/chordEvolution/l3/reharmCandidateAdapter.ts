import { degreeLabelFromOffset } from '@/data/music';
import type { EvolutionCandidate, EvolutionChange, EvolutionChord } from '@/lib/harmony/evolution';
import { splitL3InsertionDuration } from '@/lib/musicTheory';
import { transposeEvent } from '@/lib/transpose';
import type { ChordCategory, ChordEvent } from '@/types';

import {
  chordEventToEvolutionChord,
  evolutionChordsEqual,
  type EvolutionSessionProjection,
} from '../chordEventAdapter';
import type { EvolutionAdapterFailure, EvolutionAdapterResult } from '../types';

function fail(
  detail: string,
  reason: EvolutionAdapterFailure['reason'] = 'INVALID_CHANGE_SET',
): EvolutionAdapterFailure {
  return { ok: false, reason, detail };
}

function totalBeats(chords: readonly EvolutionChord[]): number {
  return chords.reduce((sum, chord) => sum + chord.durationBeats, 0);
}

function categoryFor(candidate: EvolutionCandidate): ChordCategory {
  if (candidate.technique === 'secondary_dominant') {
    return 'secondaryDominant';
  }
  if (candidate.technique === 'passing_diminished') {
    return 'passingDiminished';
  }
  return 'substituteChord';
}

function degreeLabelFor(chord: EvolutionChord): string {
  const root = degreeLabelFromOffset(chord.symbol.rootOffset);
  if (chord.symbol.definitionId === 'dim7') return `${root}°7`;
  return `${root}${chord.symbol.suffix}`;
}

function materializeChord(
  source: ChordEvent | undefined,
  chord: EvolutionChord,
  session: Pick<EvolutionSessionProjection, 'key' | 'mode'>,
  candidate: EvolutionCandidate,
): ChordEvent {
  const harmonyIdentityChanged =
    source != null &&
    (source.chordId !== chord.chordId ||
      source.rootOffset !== chord.symbol.rootOffset ||
      source.suffix !== chord.symbol.suffix);
  const event: ChordEvent = source
    ? {
        ...source,
        ...(source.rootSpelling ? { rootSpelling: { ...source.rootSpelling } } : {}),
        id: chord.eventId,
        chordId: chord.chordId,
        degreeLabel: harmonyIdentityChanged ? degreeLabelFor(chord) : source.degreeLabel,
        function: chord.function,
        durationBeats: chord.durationBeats,
        rootOffset: chord.symbol.rootOffset,
        suffix: chord.symbol.suffix,
        definitionId: chord.symbol.definitionId,
        rootSpelling: chord.symbol.rootSpelling ? { ...chord.symbol.rootSpelling } : undefined,
        bassOffset: chord.symbol.bassOffset,
        bassNote: undefined,
        category: harmonyIdentityChanged ? categoryFor(candidate) : source.category,
        isPro: harmonyIdentityChanged ? true : source.isPro,
        voicingPosition: chord.voicingPosition,
      }
    : {
        id: chord.eventId,
        chordId: chord.chordId,
        displayName: '',
        degreeLabel: degreeLabelFor(chord),
        function: chord.function,
        durationBeats: chord.durationBeats,
        isPro: true,
        rootOffset: chord.symbol.rootOffset,
        suffix: chord.symbol.suffix,
        definitionId: chord.symbol.definitionId,
        rootSpelling: chord.symbol.rootSpelling ? { ...chord.symbol.rootSpelling } : undefined,
        bassOffset: chord.symbol.bassOffset,
        category: categoryFor(candidate),
        keyContext: session.key,
        modeContext: session.mode,
        voicingPosition: chord.voicingPosition ?? 'root',
      };
  return transposeEvent(event, session.key, session.mode);
}

function validatesInsertion(
  candidate: EvolutionCandidate,
  change: Extract<EvolutionChange, { readonly kind: 'insert_before' }>,
): boolean {
  const previous = candidate.before[change.index - 1];
  const target = candidate.before[change.index];
  const split = previous ? splitL3InsertionDuration(previous.durationBeats) : null;
  const expectedEventId = `${candidate.id}:event:${target?.eventId ?? 'missing'}:${change.index}`;
  if (
    !previous ||
    !target ||
    !split ||
    change.resizedPrevious.eventId !== previous.eventId ||
    change.resizedPrevious.durationBeats !== split[0] ||
    change.inserted.durationBeats !== split[1] ||
    change.inserted.eventId !== expectedEventId ||
    candidate.after.length !== candidate.before.length + 1 ||
    !evolutionChordsEqual(candidate.after[change.index - 1]!, change.resizedPrevious) ||
    !evolutionChordsEqual(candidate.after[change.index]!, change.inserted) ||
    !evolutionChordsEqual(candidate.after[change.index + 1]!, target)
  ) {
    return false;
  }
  return candidate.before.every((before, index) => {
    if (index === change.index - 1) return true;
    const afterIndex = index < change.index ? index : index + 1;
    const after = candidate.after[afterIndex];
    return after != null && evolutionChordsEqual(before, after);
  });
}

function validatesReplacement(
  candidate: EvolutionCandidate,
  change: Extract<EvolutionChange, { readonly kind: 'replace' }>,
): boolean {
  return (
    candidate.technique === 'tritone_substitute' &&
    candidate.after.length === candidate.before.length &&
    candidate.before[change.index] != null &&
    candidate.after[change.index] != null &&
    evolutionChordsEqual(candidate.before[change.index]!, change.before) &&
    evolutionChordsEqual(candidate.after[change.index]!, change.after) &&
    candidate.before.every(
      (before, index) =>
        index === change.index || evolutionChordsEqual(before, candidate.after[index]!),
    )
  );
}

function validatesShape(candidate: EvolutionCandidate): boolean {
  if (
    candidate.level !== 'reharm' ||
    candidate.scope.kind !== 'progression' ||
    candidate.changes.length !== 1 ||
    !['secondary_dominant', 'passing_diminished', 'tritone_substitute'].includes(
      candidate.technique,
    )
  ) {
    return false;
  }
  const change = candidate.changes[0]!;
  if (change.kind === 'insert_before') {
    return (
      (candidate.technique === 'secondary_dominant' ||
        candidate.technique === 'passing_diminished') &&
      validatesInsertion(candidate, change)
    );
  }
  return validatesReplacement(candidate, change);
}

export function materializeReharmCandidateProgression(
  session: Readonly<EvolutionSessionProjection>,
  candidate: EvolutionCandidate,
): EvolutionAdapterResult<readonly ChordEvent[]> {
  const current = session.progression.map(chordEventToEvolutionChord);
  if (
    candidate.before.length !== current.length ||
    candidate.before.some(
      (before, index) => current[index] == null || !evolutionChordsEqual(before, current[index]!),
    )
  ) {
    return fail('L3 candidate baseline no longer matches the session.', 'STALE_BASELINE');
  }
  if (
    !validatesShape(candidate) ||
    totalBeats(candidate.after) !== totalBeats(candidate.before) ||
    new Set(candidate.after.map((chord) => chord.eventId)).size !== candidate.after.length
  ) {
    return fail('L3 candidate shape is not supported.');
  }

  const sourceById = new Map(session.progression.map((event) => [event.id, event] as const));
  const progression = candidate.after.map((chord) =>
    materializeChord(sourceById.get(chord.eventId), chord, session, candidate),
  );
  if (
    progression.some(
      (event, index) =>
        !evolutionChordsEqual(chordEventToEvolutionChord(event), candidate.after[index]!),
    )
  ) {
    return fail('Materialized L3 progression differs from Candidate.after.');
  }
  return { ok: true, value: progression };
}

export function selectedIndexAfterReharmCandidate(
  selected: number,
  candidate: EvolutionCandidate,
): number {
  const change = candidate.changes[0];
  return change?.kind === 'insert_before' && selected >= change.index ? selected + 1 : selected;
}
