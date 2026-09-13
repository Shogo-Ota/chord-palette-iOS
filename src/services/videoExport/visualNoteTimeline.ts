import { chordIndexForNote } from '@/lib/performance/harmonyGate';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import type { PerfChord } from '@/lib/performance/PerformanceEngine';
import type { SessionPerformancePlan } from '@/lib/performance/finalMidi/types';
import type { VisualNoteEvent } from './types';

const MIN_FINAL_MIDI_DURATION_BEAT = 1 / 64;
const HARMONIC_VISUAL_TRACKS = new Set<NoteEvent['trackId']>(['chord', 'top']);
const TIME_EPSILON_SEC = 1e-9;

function compareVisualNotes(left: VisualNoteEvent, right: VisualNoteEvent): number {
  return (
    left.startSec - right.startSec ||
    left.pitch - right.pitch ||
    left.durationSec - right.durationSec ||
    left.velocity - right.velocity
  );
}

/**
 * Onset of the chord this note actually voices. The Harmonic Gate already owns that
 * binding (declared anticipations first, then its early-attack window), so the visual
 * sidecar reuses it instead of re-deriving harmony ownership from the onset alone.
 */
function harmonyStartSecFor(
  note: NoteEvent,
  chords: readonly PerfChord[],
  secondsPerBeat: number,
  fallbackSec: number,
): number {
  const chord = chords[chordIndexForNote(chords, note)];
  return chord ? Math.max(0, chord.startBeat * secondsPerBeat) : fallbackSec;
}

/**
 * Builds Flow's read-only note sidecar from the same finalized performance plan
 * consumed by video audio. It never runs the Performance Engine or mutates the plan.
 */
export function buildVisualNoteTimeline(
  performance: SessionPerformancePlan,
  durationSec: number,
): readonly VisualNoteEvent[] {
  if (performance.bpm <= 0 || performance.totalBeats <= 0 || durationSec <= 0) {
    return Object.freeze([]);
  }

  const secondsPerBeat = 60 / performance.bpm;
  const events = performance.notes
    .filter((note) => HARMONIC_VISUAL_TRACKS.has(note.trackId))
    .map<VisualNoteEvent>((note) => {
      const sourceStartSec = note.timeBeat * secondsPerBeat;
      const sourceEndSec =
        (note.timeBeat + Math.max(MIN_FINAL_MIDI_DURATION_BEAT, note.durationBeat)) *
        secondsPerBeat;
      // OfflineMidiRenderer clamps negative scheduled frames to frame zero. Mirror
      // that final render boundary so the visual landing matches audible onset.
      const startSec = Math.max(0, sourceStartSec);
      const endSec = Math.max(0, sourceEndSec);
      return Object.freeze({
        pitch: note.pitch,
        startSec,
        durationSec: Math.max(0, endSec - startSec),
        velocity: note.velocity,
        harmonyStartSec: harmonyStartSecFor(
          note,
          performance.chords,
          secondsPerBeat,
          startSec,
        ),
      });
    })
    .filter(
      (note) =>
        note.startSec < durationSec - TIME_EPSILON_SEC && note.startSec + note.durationSec > 0,
    );

  return Object.freeze(events.sort(compareVisualNotes));
}
