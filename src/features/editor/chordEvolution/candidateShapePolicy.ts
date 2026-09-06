import type { EvolutionCandidate, EvolutionChord } from '@/lib/harmony/evolution';

export type CandidateShapePolicyResult =
  { readonly supported: true } | { readonly supported: false; readonly detail: string };

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

function commonIdentityIsStable(before: EvolutionChord, after: EvolutionChord): boolean {
  return (
    after.eventId === before.eventId &&
    after.function === before.function &&
    after.durationBeats === before.durationBeats &&
    after.voicingPosition === before.voicingPosition &&
    after.symbol.rootOffset === before.symbol.rootOffset &&
    rootSpellingEquals(after.symbol.rootSpelling, before.symbol.rootSpelling) &&
    localContextEquals(after.localHarmonicContext, before.localHarmonicContext)
  );
}

function qualityIdentityChanged(before: EvolutionChord, after: EvolutionChord): boolean {
  return (
    before.chordId !== after.chordId &&
    (before.symbol.suffix !== after.symbol.suffix ||
      before.symbol.definitionId !== after.symbol.definitionId)
  );
}

function validateQualityOnly(
  candidate: EvolutionCandidate,
  label: string,
): CandidateShapePolicyResult {
  for (let index = 0; index < candidate.before.length; index += 1) {
    const before = candidate.before[index];
    const after = candidate.after[index];
    if (!before || !after) continue;
    if (
      !commonIdentityIsStable(before, after) ||
      before.symbol.bassOffset !== after.symbol.bassOffset
    ) {
      return {
        supported: false,
        detail: `${label} may change chord quality identity only.`,
      };
    }
    if (
      (before.chordId !== after.chordId ||
        before.symbol.suffix !== after.symbol.suffix ||
        before.symbol.definitionId !== after.symbol.definitionId) &&
      !qualityIdentityChanged(before, after)
    ) {
      return {
        supported: false,
        detail: `${label} requires suffix or definitionId to change with chordId.`,
      };
    }
  }
  return { supported: true };
}

function validateSlashOnly(candidate: EvolutionCandidate): CandidateShapePolicyResult {
  for (let index = 0; index < candidate.before.length; index += 1) {
    const before = candidate.before[index];
    const after = candidate.after[index];
    if (!before || !after) continue;
    if (
      !commonIdentityIsStable(before, after) ||
      before.symbol.suffix !== after.symbol.suffix ||
      before.symbol.definitionId !== after.symbol.definitionId
    ) {
      return {
        supported: false,
        detail: 'slash_chord may change bass identity only.',
      };
    }
    if (
      (before.chordId !== after.chordId || before.symbol.bassOffset !== after.symbol.bassOffset) &&
      !(before.chordId !== after.chordId && before.symbol.bassOffset !== after.symbol.bassOffset)
    ) {
      return {
        supported: false,
        detail: 'slash_chord requires bassOffset to change with chordId.',
      };
    }
  }
  return { supported: true };
}

export function validateCandidateShape(candidate: EvolutionCandidate): CandidateShapePolicyResult {
  if (candidate.level === 'seventh' && candidate.technique === 'add_seventh') {
    return validateQualityOnly(candidate, 'add_seventh');
  }
  if (candidate.level === 'tension' && candidate.technique === 'add_tension') {
    return validateQualityOnly(candidate, 'add_tension');
  }
  if (candidate.level === 'tension' && candidate.technique === 'slash_chord') {
    return validateSlashOnly(candidate);
  }
  return {
    supported: false,
    detail: `Unsupported ${candidate.level}/${candidate.technique} candidate.`,
  };
}
