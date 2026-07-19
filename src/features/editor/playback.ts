/**
 * Bridges the editor session to the audio engine via the Performance Engine
 * (sprint-6 Step 3). Pure and side-effect free — the screen calls AudioService
 * with the resulting PlaybackRequest.
 *
 * Chord/bass rhythm, velocity, microtiming and gate come from `generatePerformance`.
 * Native accompaniment is set to `'performance'` (1:1, no re-humanize). Drums stay
 * on the native groove id so PE drum tracks are not double-played.
 */

import { generatePerformance } from '@/lib/performance/PerformanceEngine';
import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import { chordMidiNotes } from '@/lib/voicing';
import {
  mapPerfNotesToPlaybackRequest,
  performanceSeedFromSession,
} from '@/services/audio/performanceMapper';
import type { PlaybackRequest, PreviewRequest } from '@/services/audio/types';
import type { ChordEvent, MajorKey } from '@/types';
import type { EditorSession } from './session';

/** Build the full playback request for the current session. */
export function sessionToPlaybackRequest(session: EditorSession, loop: boolean): PlaybackRequest {
  const chords = progressionToPerfChords(session.progression, session.key);
  const totalBeats = chords.reduce(
    (max, c) => Math.max(max, c.startBeat + c.durationBeats),
    0,
  );
  const seed = performanceSeedFromSession({
    key: session.key,
    tempoBpm: session.tempoBpm,
    grooveId: session.grooveId,
    accompanimentPattern: session.accompanimentPattern,
    instrumentId: session.instrumentId,
    progression: session.progression,
  });
  const notes = generatePerformance(
    { chords, bpm: session.tempoBpm, seed },
    // Native DrumProvider owns the groove; do not emit PE drum tracks.
    { styleId: session.accompanimentPattern, drums: false },
  );
  return mapPerfNotesToPlaybackRequest(notes, {
    bpm: session.tempoBpm,
    totalBeats,
    loop,
    drumPatternId: session.grooveId,
    instrument: session.instrumentId,
  });
}

/** Single-chord audition for a library/timeline tap (context-free voicing). */
export function chordPreviewRequest(
  chord: Pick<ChordEvent, 'rootOffset' | 'suffix' | 'bassOffset'>,
  key: MajorKey,
  bpm: number,
  instrument: string,
): PreviewRequest {
  return { midiNotes: chordMidiNotes(chord, key), velocity: 100, lengthBeats: 2, bpm, instrument };
}
