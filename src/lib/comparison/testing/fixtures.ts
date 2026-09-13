import type { ComparisonSnapshotSource, CreationSnapshotV1 } from '@/lib/comparison';
import { createComparisonSnapshot } from '@/lib/comparison';
import type { ChordEvent } from '@/types';

export function chord(
  id: string,
  displayName: string,
  rootOffset: number,
  suffix = '',
  definitionId = suffix === 'm' ? 'minor' : 'major',
): ChordEvent {
  return {
    id,
    chordId: `${rootOffset}:${definitionId}`,
    displayName,
    degreeLabel: displayName,
    function: rootOffset === 7 ? 'dominant' : rootOffset === 5 ? 'subdominant' : 'tonic',
    durationBeats: 4,
    isPro: false,
    rootOffset,
    suffix,
    definitionId,
    keyContext: 'C',
    modeContext: 'major',
    voicingPosition: 'root',
    category: 'diatonic',
  };
}

export function comparisonSource(
  overrides: Partial<ComparisonSnapshotSource> = {},
): ComparisonSnapshotSource {
  return {
    sourceProjectId: 'p-test',
    title: 'Comparison',
    key: 'C',
    mode: 'major',
    tempoBpm: 100,
    instrumentId: 'piano',
    grooveId: 'pop8',
    accompanimentPattern: 'block',
    accompanimentVariant: 'block.type1',
    accompanimentEnergy: 'build',
    releaseCut: false,
    instrumentEffect: 'sustain',
    octaveShift: 0,
    drumMode: 'clap',
    drumBeat: '8',
    progression: [
      chord('c1', 'C', 0),
      chord('c2', 'Am', 9, 'm', 'minor'),
      chord('c3', 'F', 5),
      chord('c4', 'G', 7),
    ],
    ...overrides,
  };
}

export function snapshot(overrides: Partial<ComparisonSnapshotSource> = {}): CreationSnapshotV1 {
  const result = createComparisonSnapshot(comparisonSource(overrides));
  if (!result.ok) throw new Error(`Snapshot fixture failed: ${result.reason}`);
  return result.value;
}
