import type { EvolutionCandidate, EvolutionChord } from '../../types';

function chordFingerprint(chord: EvolutionChord): string {
  return [
    chord.symbol.rootOffset,
    chord.symbol.suffix,
    chord.symbol.definitionId ?? '',
    chord.symbol.bassOffset ?? '',
    chord.durationBeats,
  ].join(':');
}

export function evolutionCandidateFingerprint(candidate: EvolutionCandidate): string {
  return candidate.after.map(chordFingerprint).join('|');
}
