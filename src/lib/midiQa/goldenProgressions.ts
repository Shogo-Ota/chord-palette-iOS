/**
 * Golden Progressions A–F — the fixed corpus every accompaniment quality gate and
 * experiment renders. Distinct from {@link QA_PROGRESSIONS}, which is the older MIDI
 * QA corpus: this set is the one the accompaniment quality contract is defined
 * against, and it deliberately covers slash bass (D) and an altered dominant (F).
 *
 * Key is C major and `rootOffset` is measured from the tonic, matching
 * `chordHarmonyFromEvent`. Data only — no generation logic.
 */

import type { ChordDuration, ChordEvent, MajorKey } from '@/types';

export type GoldenProgressionId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export type GoldenProgression = {
  id: GoldenProgressionId;
  name: string;
  key: MajorKey;
  bpm: number;
  chords: ChordEvent[];
};

type GoldenChordSpec = {
  displayName: string;
  rootOffset: number;
  suffix: string;
  definitionId?: string;
  /** Slash bass, in semitones from the tonic. */
  bassOffset?: number;
};

function ev(spec: GoldenChordSpec, index: number, durationBeats: ChordDuration = 4): ChordEvent {
  return {
    id: `golden-${spec.displayName}-${index}`,
    chordId: `golden-${spec.displayName}`,
    displayName: spec.displayName,
    degreeLabel: '',
    function: 'tonic',
    durationBeats,
    isPro: false,
    rootOffset: spec.rootOffset,
    suffix: spec.suffix,
    definitionId: spec.definitionId,
    bassOffset: spec.bassOffset,
  };
}

function line(
  id: GoldenProgressionId,
  name: string,
  key: MajorKey,
  specs: readonly GoldenChordSpec[],
): GoldenProgression {
  return { id, name, key, bpm: 90, chords: specs.map((spec, i) => ev(spec, i)) };
}

export const GOLDEN_PROGRESSIONS: readonly GoldenProgression[] = [
  line('A', 'C | Am | F | G', 'C', [
    { displayName: 'C', rootOffset: 0, suffix: '' },
    { displayName: 'Am', rootOffset: 9, suffix: 'm' },
    { displayName: 'F', rootOffset: 5, suffix: '' },
    { displayName: 'G', rootOffset: 7, suffix: '' },
  ]),
  line('B', 'D | Bm | G | A', 'C', [
    { displayName: 'D', rootOffset: 2, suffix: '' },
    { displayName: 'Bm', rootOffset: 11, suffix: 'm' },
    { displayName: 'G', rootOffset: 7, suffix: '' },
    { displayName: 'A', rootOffset: 9, suffix: '' },
  ]),
  line('C', 'Cmaj7 | Am7 | Fmaj7 | G7', 'C', [
    { displayName: 'Cmaj7', rootOffset: 0, suffix: 'maj7', definitionId: 'maj7' },
    { displayName: 'Am7', rootOffset: 9, suffix: 'm7', definitionId: 'm7' },
    { displayName: 'Fmaj7', rootOffset: 5, suffix: 'maj7', definitionId: 'maj7' },
    { displayName: 'G7', rootOffset: 7, suffix: '7', definitionId: 'dom7' },
  ]),
  line('D', 'C | G/B | Am | F', 'C', [
    { displayName: 'C', rootOffset: 0, suffix: '' },
    { displayName: 'G/B', rootOffset: 7, suffix: '', bassOffset: 11 },
    { displayName: 'Am', rootOffset: 9, suffix: 'm' },
    { displayName: 'F', rootOffset: 5, suffix: '' },
  ]),
  line('E', 'C | Cadd9 | Cmaj7 | C7', 'C', [
    { displayName: 'C', rootOffset: 0, suffix: '' },
    { displayName: 'Cadd9', rootOffset: 0, suffix: 'add9', definitionId: 'add9' },
    { displayName: 'Cmaj7', rootOffset: 0, suffix: 'maj7', definitionId: 'maj7' },
    { displayName: 'C7', rootOffset: 0, suffix: '7', definitionId: 'dom7' },
  ]),
  line('F', 'Gm9 | C7(♭9) | Am7 | Dm7', 'C', [
    { displayName: 'Gm9', rootOffset: 7, suffix: 'm9', definitionId: 'm9' },
    { displayName: 'C7(♭9)', rootOffset: 0, suffix: '7(♭9)', definitionId: 'dom7_b9' },
    { displayName: 'Am7', rootOffset: 9, suffix: 'm7', definitionId: 'm7' },
    { displayName: 'Dm7', rootOffset: 2, suffix: 'm7', definitionId: 'm7' },
  ]),
];

export function goldenProgressionById(id: GoldenProgressionId): GoldenProgression {
  const found = GOLDEN_PROGRESSIONS.find((p) => p.id === id);
  if (!found) throw new Error(`unknown golden progression ${id}`);
  return found;
}
