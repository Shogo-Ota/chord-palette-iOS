/**
 * v1.01 release listening progression — representative chord types for Human MIDI QA.
 * Key: C major, 4 beats per chord, 72 BPM recommended.
 */

import type { ChordEvent } from '@/types';

export type ListeningPatternSlot = 'normal' | 'ballad' | 'arpeggio';

export interface ListeningPatternPreset {
  slot: ListeningPatternSlot;
  label: string;
  templateId: string;
  accompanimentPattern: 'natural' | 'relaxed' | 'arpeggio';
  grooveId: 'pop8';
}

export const V101_LISTENING_PATTERNS: readonly ListeningPatternPreset[] = [
  {
    slot: 'normal',
    label: 'Normal',
    templateId: 'human.normal.p1_a1',
    accompanimentPattern: 'natural',
    grooveId: 'pop8',
  },
  {
    slot: 'ballad',
    label: 'Ballad',
    templateId: 'human.ballad.p1_c7',
    accompanimentPattern: 'relaxed',
    grooveId: 'pop8',
  },
  {
    slot: 'arpeggio',
    label: 'Arpeggio',
    templateId: 'human.arpeggio.p1_c10',
    accompanimentPattern: 'arpeggio',
    grooveId: 'pop8',
  },
];

/** C → Am → Cmaj7 → G7 → Am7 → Cadd9 (major / minor / maj7 / dom7 / m7 / add9). */
export function buildV101ListeningChords(ids: () => string): ChordEvent[] {
  const mk = (
    displayName: string,
    rootOffset: number,
    suffix: string,
    fn: ChordEvent['function'],
    degreeLabel: string,
  ): ChordEvent => ({
    id: ids(),
    chordId: displayName,
    displayName,
    degreeLabel,
    function: fn,
    isPro: false,
    rootOffset,
    suffix,
    durationBeats: 4,
  });

  return [
    mk('C', 0, '', 'tonic', 'I'),
    mk('Am', 9, 'm', 'tonic', 'vi'),
    mk('Cmaj7', 0, 'maj7', 'tonic', 'I'),
    mk('G7', 7, '7', 'dominant', 'V'),
    mk('Am7', 9, 'm7', 'tonic', 'vi'),
    mk('Cadd9', 0, 'add9', 'tonic', 'I'),
  ];
}

export const V101_LISTENING_CHECKLIST = [
  'コード外音がない（各コードの構成音のみ）',
  'Human timing / groove が自然',
  'register が極端に高すぎ / 低すぎない',
  'mud（低域の濁り）が目立たない',
  'Pattern 切替で伴奏が変わる',
] as const;
