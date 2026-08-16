/**
 * MIDI QA corpus progressions A–F. Shared by the generator and validators.
 * Key is C major; rootOffset is from the tonic.
 */

import type { ChordDuration, ChordEvent, MajorKey } from '@/types';

export type QaProgressionId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export type QaProgression = {
  id: QaProgressionId;
  name: string;
  key: MajorKey;
  bpm: number;
  chords: ChordEvent[];
};

function ev(
  displayName: string,
  rootOffset: number,
  suffix: string,
  index: number,
  durationBeats: ChordDuration = 4,
): ChordEvent {
  return {
    id: `midi-qa-${displayName}-${index}`,
    chordId: `midi-qa-${displayName}`,
    displayName,
    degreeLabel: '',
    function: 'tonic',
    durationBeats,
    isPro: false,
    rootOffset,
    suffix,
  };
}

function line(
  id: QaProgressionId,
  name: string,
  specs: Array<[string, number, string]>,
): QaProgression {
  return {
    id,
    name,
    key: 'C',
    bpm: 90,
    chords: specs.map(([displayName, rootOffset, suffix], i) =>
      ev(displayName, rootOffset, suffix, i),
    ),
  };
}

export const QA_PROGRESSIONS: readonly QaProgression[] = [
  line('A', 'C | Am | F | G', [
    ['C', 0, ''],
    ['Am', 9, 'm'],
    ['F', 5, ''],
    ['G', 7, ''],
  ]),
  line('B', 'D | Bm | G | A', [
    ['D', 2, ''],
    ['Bm', 11, 'm'],
    ['G', 7, ''],
    ['A', 9, ''],
  ]),
  line('C', 'F | Dm | Bb | C', [
    ['F', 5, ''],
    ['Dm', 2, 'm'],
    ['Bb', 10, ''],
    ['C', 0, ''],
  ]),
  line('D', 'Cmaj7 | Am7 | Fmaj7 | G7', [
    ['Cmaj7', 0, 'maj7'],
    ['Am7', 9, 'm7'],
    ['Fmaj7', 5, 'maj7'],
    ['G7', 7, '7'],
  ]),
  line('E', 'Cadd9 | Am7 | Fadd9 | G7', [
    ['Cadd9', 0, 'add9'],
    ['Am7', 9, 'm7'],
    ['Fadd9', 5, 'add9'],
    ['G7', 7, '7'],
  ]),
  line('F', 'C | Cm | Cmaj7 | C7 | Cm7 | Cadd9', [
    ['C', 0, ''],
    ['Cm', 0, 'm'],
    ['Cmaj7', 0, 'maj7'],
    ['C7', 0, '7'],
    ['Cm7', 0, 'm7'],
    ['Cadd9', 0, 'add9'],
  ]),
];

export function qaProgressionById(id: QaProgressionId): QaProgression {
  const found = QA_PROGRESSIONS.find((p) => p.id === id);
  if (!found) throw new Error(`unknown QA progression ${id}`);
  return found;
}
