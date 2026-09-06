import { L3_RANKING_POLICY } from '@/lib/musicTheory';
import { getDefinitionById, getDefinitionBySymbol } from '@/lib/theory/definitions';

import type {
  EvolutionCandidate,
  EvolutionChord,
  EvolutionScoreComponent,
  ReharmTechnique,
} from '../../types';
import type { L3ScoreComponentId } from '../contracts';
import { normalizedPitchClass } from '../providers/providerGuards';

function circularDistance(left: number, right: number): number {
  const distance = Math.abs(normalizedPitchClass(left) - normalizedPitchClass(right));
  return Math.min(distance, 12 - distance);
}

function pitchClasses(chord: EvolutionChord): readonly number[] {
  const definition = chord.symbol.definitionId
    ? getDefinitionById(chord.symbol.definitionId)
    : getDefinitionBySymbol(chord.symbol.suffix);
  return (
    definition?.intervals.map((interval) =>
      normalizedPitchClass(chord.symbol.rootOffset + interval),
    ) ?? []
  );
}

function voiceLeadingCost(chords: readonly EvolutionChord[]): number {
  let cost = 0;
  for (let index = 0; index < chords.length - 1; index += 1) {
    const left = pitchClasses(chords[index]!);
    const right = pitchClasses(chords[index + 1]!);
    cost += left.reduce(
      (sum, pitch) => sum + Math.min(...right.map((other) => circularDistance(pitch, other))),
      0,
    );
  }
  return cost;
}

function bassMovementCost(chords: readonly EvolutionChord[]): number {
  let cost = 0;
  for (let index = 0; index < chords.length - 1; index += 1) {
    const left = chords[index]!;
    const right = chords[index + 1]!;
    cost += circularDistance(
      left.symbol.bassOffset ?? left.symbol.rootOffset,
      right.symbol.bassOffset ?? right.symbol.rootOffset,
    );
  }
  return cost;
}

function commonToneScore(chords: readonly EvolutionChord[]): number {
  let score = 0;
  for (let index = 0; index < chords.length - 1; index += 1) {
    const left = new Set(pitchClasses(chords[index]!));
    score += pitchClasses(chords[index + 1]!).filter((pitch) => left.has(pitch)).length;
  }
  return score;
}

function resolutionStrength(technique: ReharmTechnique): number {
  if (technique === 'secondary_dominant' || technique === 'tritone_substitute') {
    return 5;
  }
  if (technique === 'passing_diminished') return 4;
  if (technique === 'add_tension') return 3;
  if (technique === 'slash_chord') return 2;
  return 0;
}

function harmonicFunctionFit(technique: ReharmTechnique): number {
  if (technique === 'secondary_dominant' || technique === 'tritone_substitute') {
    return 5;
  }
  if (technique === 'passing_diminished') return 4;
  return technique === 'add_tension' || technique === 'slash_chord' ? 3 : 0;
}

function tensionValidity(candidate: EvolutionCandidate): number {
  if (candidate.technique !== 'add_tension') return 4;
  return candidate.changes.every((change) => {
    if (change.kind !== 'replace') return false;
    const definitionId = change.after.symbol.definitionId;
    const definition = definitionId
      ? getDefinitionById(definitionId)
      : getDefinitionBySymbol(change.after.symbol.suffix);
    return definition?.category === 'tension';
  })
    ? 5
    : 0;
}

function complexityDelta(candidate: EvolutionCandidate): number {
  const noteCount = (chords: readonly EvolutionChord[]) =>
    chords.reduce((sum, chord) => sum + pitchClasses(chord).length, 0);
  return Math.max(
    0,
    candidate.after.length -
      candidate.before.length +
      noteCount(candidate.after) -
      noteCount(candidate.before),
  );
}

function componentsFor(
  candidate: EvolutionCandidate,
): readonly (EvolutionScoreComponent & { readonly id: L3ScoreComponentId })[] {
  return [
    {
      id: 'resolutionStrength',
      value: resolutionStrength(candidate.technique),
    },
    { id: 'voiceLeadingCost', value: voiceLeadingCost(candidate.after) },
    { id: 'bassMovementCost', value: bassMovementCost(candidate.after) },
    { id: 'commonToneScore', value: commonToneScore(candidate.after) },
    {
      id: 'harmonicFunctionFit',
      value: harmonicFunctionFit(candidate.technique),
    },
    { id: 'tensionValidity', value: tensionValidity(candidate) },
    { id: 'complexityDelta', value: complexityDelta(candidate) },
  ];
}

export function scoreEvolutionCandidate(candidate: EvolutionCandidate): EvolutionCandidate {
  const components = componentsFor(candidate);
  const total = components.reduce(
    (sum, component) => sum + component.value * L3_RANKING_POLICY.componentWeights[component.id],
    0,
  );
  return {
    ...candidate,
    score: {
      status: 'SCORED',
      total,
      components,
    },
  };
}
