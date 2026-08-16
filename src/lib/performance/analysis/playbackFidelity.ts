/**
 * What the CURRENT native playback can and cannot reproduce from a rendered take.
 *
 * `computeMetrics` answers "what did the engine write". This answers the different
 * question that the 音質 investigation needs: of the notes the engine wrote, how many
 * does the device actually sound as written? The iOS voice
 * (`modules/chord-audio/ios/SampledInstrumentProvider.swift`) pre-renders ONE buffer
 * per MIDI note and reads it back, which imposes three hard limits the generation
 * layer knows nothing about:
 *
 *   - a note held past the captured tail falls silent mid-note (`idx >= len → 0`)
 *   - a pitch outside the captured range is CLAMPED, so it sounds a different note
 *   - two identical pitches on the same onset read the same buffer twice, which is
 *     amplitude doubling rather than two voices
 *
 * The constants below mirror the Swift ones; they are the contract this module
 * measures against, not a preference. Keep them in sync until the playback layer is
 * rebuilt, at which point the limits (and this module's thresholds) change with it.
 *
 * Pure: no RN/Expo, no native imports. Consumed by the audition harness and by the
 * sound-regression gate.
 */

import type { NoteEvent, TrackId } from '../NoteEvent';

/** `SampledInstrumentProvider.captureSeconds` — how much of each note exists. */
export const SAMPLE_TAIL_SECONDS = 3.0;
/** `SampledInstrumentProvider.lowNote` / `.highNote` — outside this, pitch is clamped. */
export const CAPTURED_PITCH_MIN = 24;
export const CAPTURED_PITCH_MAX = 84;
/** `AudioEngineController.maxChordPolyphony` — voices beyond this are skipped. */
export const POLYPHONY_CAP = 24;

/** Pitched voices; drum notes are percussion numbers played by a different provider. */
const PITCHED: ReadonlySet<TrackId> = new Set<TrackId>(['chord', 'top', 'bass']);

export interface PlaybackFidelityReport {
  /** Pitched notes examined. */
  notes: number;
  /** Notes longer than the captured tail: audible as the note dropping out. */
  tailTruncatedNotes: number;
  /** Longest note in seconds — compare against {@link SAMPLE_TAIL_SECONDS}. */
  longestNoteSeconds: number;
  /** Notes whose pitch is clamped into the captured range: sounds a wrong pitch. */
  clampedPitchNotes: number;
  /** Largest clamp distance in semitones (0 when nothing is clamped). */
  worstClampSemitones: number;
  /** Extra notes sharing an onset AND a pitch: doubling, not a second voice. */
  unisonCollisions: number;
  /** Notes struck while the polyphony cap is already full. */
  voiceCappedNotes: number;
  /** Distinct velocity values — the dynamic resolution the take asks for. */
  velocityLevels: number;
}

function secondsPerBeat(bpm: number): number {
  return 60 / Math.max(1, bpm);
}

function onsetKey(beat: number): number {
  return Math.round(beat * 1e6);
}

/** Notes struck at a moment when {@link POLYPHONY_CAP} voices already sound. */
function voiceCappedNotes(notes: readonly NoteEvent[]): number {
  const sorted = [...notes].sort((a, b) => a.timeBeat - b.timeBeat);
  let capped = 0;
  for (const note of sorted) {
    let sounding = 0;
    for (const other of sorted) {
      if (other === note) continue;
      if (other.timeBeat > note.timeBeat + 1e-9) break;
      if (other.timeBeat + other.durationBeat > note.timeBeat + 1e-9) sounding++;
    }
    if (sounding >= POLYPHONY_CAP) capped++;
  }
  return capped;
}

/**
 * Measure a take against the current playback limits. `bpm` is required because two
 * of the three limits are in seconds, not beats: the same take is reproduced faithfully
 * at 140 BPM and truncated at 60 BPM.
 */
export function analyzePlaybackFidelity(
  notes: readonly NoteEvent[],
  bpm: number,
): PlaybackFidelityReport {
  const pitched = notes.filter((n) => PITCHED.has(n.trackId));
  const spb = secondsPerBeat(bpm);

  let tailTruncatedNotes = 0;
  let longestNoteSeconds = 0;
  let clampedPitchNotes = 0;
  let worstClampSemitones = 0;
  const onsets = new Map<number, Set<number>>();
  let unisonCollisions = 0;
  const velocities = new Set<number>();

  for (const note of pitched) {
    const seconds = note.durationBeat * spb;
    longestNoteSeconds = Math.max(longestNoteSeconds, seconds);
    if (seconds > SAMPLE_TAIL_SECONDS + 1e-9) tailTruncatedNotes++;

    const clamped = Math.min(Math.max(note.pitch, CAPTURED_PITCH_MIN), CAPTURED_PITCH_MAX);
    if (clamped !== note.pitch) {
      clampedPitchNotes++;
      worstClampSemitones = Math.max(worstClampSemitones, Math.abs(clamped - note.pitch));
    }

    const key = onsetKey(note.timeBeat);
    const atOnset = onsets.get(key) ?? new Set<number>();
    if (atOnset.has(note.pitch)) unisonCollisions++;
    atOnset.add(note.pitch);
    onsets.set(key, atOnset);

    velocities.add(note.velocity);
  }

  return {
    notes: pitched.length,
    tailTruncatedNotes,
    longestNoteSeconds,
    clampedPitchNotes,
    worstClampSemitones,
    unisonCollisions,
    voiceCappedNotes: voiceCappedNotes(pitched),
    velocityLevels: velocities.size,
  };
}
