/**
 * Fixed evaluation progressions A–D (implementation_v1.01 Phase 9).
 *
 * These four progressions are the shared yardstick for accompaniment quality:
 * every before/after comparison and every engine-invariant test renders the SAME
 * material, so a change in the numbers means the engine changed — not the input.
 * Pure domain data (no RN/Expo imports); consumed by the integrity/determinism/
 * stress tests now and by the Phase 9 analysis report tooling later.
 */

import type { ChordEvent, MajorKey } from '@/types';

export interface EvalProgression {
  id: 'A' | 'B' | 'C' | 'D';
  /** Human-readable chord line, for report headings. */
  name: string;
  key: MajorKey;
  bpm: number;
  chords: ChordEvent[];
}

/** A one-bar chord event carrying only what the performance pipeline reads. */
function ev(rootOffset: number, suffix: string, index: number): ChordEvent {
  return {
    id: `eval-${rootOffset}-${suffix}-${index}`,
    chordId: `eval-${rootOffset}-${suffix}`,
    displayName: `${rootOffset}:${suffix}`,
    degreeLabel: '',
    function: 'tonic',
    durationBeats: 4,
    isPro: false,
    rootOffset,
    suffix,
  };
}

function progression(offsets: [number, string][]): ChordEvent[] {
  return offsets.map(([rootOffset, suffix], i) => ev(rootOffset, suffix, i));
}

/**
 * The four fixed test progressions, all 4/4 and keyed in C:
 *   A: C – G – Am – F        (120 BPM)
 *   B: Cmaj7 – Am7 – Dm7 – G7 (100 BPM)
 *   C: Am – F – C – G        (140 BPM)
 *   D: Dm7 – G7 – Cmaj7 – A7  (90 BPM)
 */
export const EVAL_PROGRESSIONS: readonly EvalProgression[] = [
  {
    id: 'A',
    name: 'C - G - Am - F',
    key: 'C',
    bpm: 120,
    chords: progression([
      [0, ''],
      [7, ''],
      [9, 'm'],
      [5, ''],
    ]),
  },
  {
    id: 'B',
    name: 'Cmaj7 - Am7 - Dm7 - G7',
    key: 'C',
    bpm: 100,
    chords: progression([
      [0, 'maj7'],
      [9, 'm7'],
      [2, 'm7'],
      [7, '7'],
    ]),
  },
  {
    id: 'C',
    name: 'Am - F - C - G',
    key: 'C',
    bpm: 140,
    chords: progression([
      [9, 'm'],
      [5, ''],
      [0, ''],
      [7, ''],
    ]),
  },
  {
    id: 'D',
    name: 'Dm7 - G7 - Cmaj7 - A7',
    key: 'C',
    bpm: 90,
    chords: progression([
      [2, 'm7'],
      [7, '7'],
      [0, 'maj7'],
      [9, '7'],
    ]),
  },
];
