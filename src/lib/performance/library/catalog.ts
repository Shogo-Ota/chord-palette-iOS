/**
 * Built-in LibraryPattern catalog (Ballad first).
 *
 * Patterns are relative fixtures derived from accompaniment-purpose MIDI shape
 * (see ingest tests). Raw MIDI is never stored here.
 */

import type { LibraryPattern } from './types';

const TS = '2026-08-13T00:00:00.000Z';

/**
 * Ballad piano: 1-bar broken hold (root → 5th → 3rd → 5th) with a thinner
 * fourth-bar variation. Chord-tone only. preferCommonTones for VL bias.
 */
export const BALLAD_PIANO_BROKEN_HOLD_V1: LibraryPattern = {
  id: 'ballad.piano.brokenHold.v1',
  name: 'Ballad piano broken hold v1',
  sourceType: 'original',
  license: '自作 — オーナー伴奏用打ち込み（相対登録）',
  style: 'ballad',
  rhythmFeel: 'straight',
  timeSignature: { beatsPerBar: 4, beatUnit: 4 },
  bpmRange: { min: 60, max: 100 },
  instrumentRole: 'piano',
  patternLengthBeats: 4,
  notes: [
    { posBeats: 0, chordToneIndex: 0, octaveOffset: 0, velocityRatio: 0.85, durationBeats: 1.9 },
    { posBeats: 0, chordToneIndex: 2, octaveOffset: 0, velocityRatio: 0.7, durationBeats: 1.9 },
    { posBeats: 2, chordToneIndex: 1, octaveOffset: 0, velocityRatio: 0.75, durationBeats: 1.8 },
    { posBeats: 3, chordToneIndex: 2, octaveOffset: 0, velocityRatio: 0.65, durationBeats: 0.9 },
  ],
  phraseVariation: {
    barInPhrase: 3,
    notes: [
      { posBeats: 0, chordToneIndex: 0, octaveOffset: 0, velocityRatio: 0.8, durationBeats: 1.5 },
      { posBeats: 1.5, chordToneIndex: 1, octaveOffset: 0, velocityRatio: 0.7, durationBeats: 0.7 },
      { posBeats: 2.5, chordToneIndex: 2, octaveOffset: 0, velocityRatio: 0.65, durationBeats: 1.2 },
    ],
  },
  progressionHints: {
    preferCommonTones: true,
    topVoiceMaxStep: 7,
    bassMotion: 'root',
  },
  accentMap: [0.85, 0, 0.75, 0.65],
  tags: ['ballad', 'piano', 'broken', 'hold'],
  qualityRating: 3,
  createdAt: TS,
  updatedAt: TS,
  version: 1,
};

const CATALOG: Record<string, LibraryPattern> = {
  [BALLAD_PIANO_BROKEN_HOLD_V1.id]: BALLAD_PIANO_BROKEN_HOLD_V1,
};

/** Lookup a built-in pattern by id. Unknown → undefined. */
export function libraryPatternById(id: string): LibraryPattern | undefined {
  return CATALOG[id];
}

/** Ballad default library pattern id when the engine opt-in flag is used. */
export const BALLAD_DEFAULT_LIBRARY_PATTERN_ID = BALLAD_PIANO_BROKEN_HOLD_V1.id;
