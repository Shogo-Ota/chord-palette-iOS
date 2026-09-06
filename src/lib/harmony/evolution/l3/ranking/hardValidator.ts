import { getDefinitionById, getDefinitionBySymbol } from '@/lib/theory/definitions';

import type { EvolutionCandidate, EvolutionChord, EvolutionContext } from '../../types';
import {
  directedSemitone,
  normalizedPitchClass,
  sourceDefinition,
} from '../providers/providerGuards';

function chordEquals(left: EvolutionChord, right: EvolutionChord): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function totalBeats(chords: readonly EvolutionChord[]): number {
  return chords.reduce((sum, chord) => sum + chord.durationBeats, 0);
}

function hasKnownDefinitions(chords: readonly EvolutionChord[]): boolean {
  return chords.every((chord) => {
    const definitionId = chord.symbol.definitionId;
    const definition = definitionId
      ? getDefinitionById(definitionId)
      : getDefinitionBySymbol(chord.symbol.suffix);
    return definition?.symbol === chord.symbol.suffix;
  });
}

function validatesSecondaryDominant(candidate: EvolutionCandidate): boolean {
  const change = candidate.changes[0];
  if (change?.kind !== 'insert_before') return false;
  const target = candidate.after[change.index + 1];
  return (
    change.inserted.symbol.definitionId === 'dom7' &&
    target != null &&
    normalizedPitchClass(change.inserted.symbol.rootOffset + 5) ===
      normalizedPitchClass(target.symbol.rootOffset)
  );
}

function validatesPassingDiminished(candidate: EvolutionCandidate): boolean {
  const change = candidate.changes[0];
  if (change?.kind !== 'insert_before') return false;
  const previous = candidate.after[change.index - 1];
  const target = candidate.after[change.index + 1];
  if (!previous || !target || change.inserted.symbol.definitionId !== 'dim7') {
    return false;
  }
  const first = directedSemitone(
    previous.symbol.bassOffset ?? previous.symbol.rootOffset,
    change.inserted.symbol.rootOffset,
  );
  const second = directedSemitone(
    change.inserted.symbol.rootOffset,
    target.symbol.bassOffset ?? target.symbol.rootOffset,
  );
  return first != null && first === second;
}

function validatesTritoneSubstitute(candidate: EvolutionCandidate): boolean {
  const change = candidate.changes[0];
  if (change?.kind !== 'replace') return false;
  const resolutionTarget = candidate.before[change.index + 1];
  return (
    resolutionTarget != null &&
    sourceDefinition(change.before)?.id === 'dom7' &&
    sourceDefinition(change.after)?.id === 'dom7' &&
    normalizedPitchClass(change.before.symbol.rootOffset + 5) ===
      normalizedPitchClass(resolutionTarget.symbol.rootOffset) &&
    normalizedPitchClass(change.before.symbol.rootOffset + 6) ===
      normalizedPitchClass(change.after.symbol.rootOffset)
  );
}

function validatesTechnique(candidate: EvolutionCandidate): boolean {
  if (candidate.technique === 'add_tension' || candidate.technique === 'slash_chord') {
    return candidate.level === 'tension';
  }
  if (candidate.technique === 'secondary_dominant') {
    return validatesSecondaryDominant(candidate);
  }
  if (candidate.technique === 'passing_diminished') {
    return validatesPassingDiminished(candidate);
  }
  if (candidate.technique === 'tritone_substitute') {
    return validatesTritoneSubstitute(candidate);
  }
  return false;
}

export function isValidReharmCandidate(
  context: EvolutionContext,
  candidate: EvolutionCandidate,
): boolean {
  return (
    context.level === 'reharm' &&
    context.mode === 'major' &&
    context.scope.kind === 'progression' &&
    candidate.scope.kind === 'progression' &&
    candidate.before.length === context.progression.length &&
    candidate.before.every(
      (chord, index) =>
        context.progression[index] != null && chordEquals(chord, context.progression[index]!),
    ) &&
    candidate.after.length > 0 &&
    new Set(candidate.after.map((chord) => chord.eventId)).size === candidate.after.length &&
    totalBeats(candidate.after) === totalBeats(candidate.before) &&
    hasKnownDefinitions(candidate.before) &&
    hasKnownDefinitions(candidate.after) &&
    candidate.changes.length > 0 &&
    candidate.theorySources.length > 0 &&
    validatesTechnique(candidate)
  );
}
