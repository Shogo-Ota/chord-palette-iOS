/**
 * Verification-only fixtures for the Phase 2A dev-audio screen. The fixed
 * progression lives here (TypeScript), NOT inside Swift — the native engine
 * only ever receives a generic PlaybackRequest (§2 item 2).
 */

import { buildProgression, type ChordSpec } from '@/services/audio/schedule';
import type { PlaybackRequest, PreviewRequest } from '@/services/audio/types';

/** Cmaj7 → G7 → Am7 → Fmaj7, one bar (4 beats) each. */
export const VERIFICATION_CHORDS: ChordSpec[] = [
  { midiNotes: [60, 64, 67, 71], lengthBeats: 4 }, // Cmaj7
  { midiNotes: [55, 59, 62, 65], lengthBeats: 4 }, // G7
  { midiNotes: [57, 60, 64, 67], lengthBeats: 4 }, // Am7
  { midiNotes: [53, 57, 60, 64], lengthBeats: 4 }, // Fmaj7
];

export const VERIFICATION_BPM = 120;
export const VERIFICATION_DRUM_PATTERN = 'pop8-min';

/** Build the generic PlaybackRequest for the verification progression. */
export function buildVerificationRequest(loop = true): PlaybackRequest {
  const { chordEvents, totalBeats } = buildProgression(VERIFICATION_CHORDS, 100);
  return {
    bpm: VERIFICATION_BPM,
    totalBeats,
    loop,
    chordEvents,
    drumPatternId: VERIFICATION_DRUM_PATTERN,
    instrument: 'piano',
  };
}

/** Single Cmaj7 audition. */
export function verificationPreview(): PreviewRequest {
  return {
    midiNotes: [60, 64, 67, 71],
    velocity: 100,
    lengthBeats: 2,
    bpm: VERIFICATION_BPM,
    instrument: 'piano',
  };
}
