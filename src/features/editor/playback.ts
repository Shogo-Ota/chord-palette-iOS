/**
 * Bridges the editor session to the audio engine: turns the current composition
 * (progression + key + tempo + groove) into the generic {@link PlaybackRequest}
 * the native engine consumes. Pure and side-effect free — the screen calls the
 * AudioService with the result.
 */

import { chordMidiNotes, progressionToChordSpecs } from '@/lib/voicing';
import { buildProgression } from '@/services/audio/schedule';
import type { PlaybackRequest, PreviewRequest } from '@/services/audio/types';
import type { ChordEvent, MajorKey } from '@/types';
import type { EditorSession } from './session';

/** Build the full playback request for the current session. */
export function sessionToPlaybackRequest(session: EditorSession, loop: boolean): PlaybackRequest {
  const specs = progressionToChordSpecs(session.progression, session.key);
  const { chordEvents, totalBeats } = buildProgression(specs);
  return {
    bpm: session.tempoBpm,
    totalBeats,
    loop,
    chordEvents,
    // Native selects the concrete drum pattern by this groove id.
    drumPatternId: session.grooveId,
    // Native applies this accompaniment rhythm to each chord's body notes.
    accompaniment: session.accompanimentPattern,
    instrument: session.instrumentId,
  };
}

/** Single-chord audition for a library/timeline tap. */
export function chordPreviewRequest(
  chord: Pick<ChordEvent, 'rootOffset' | 'suffix' | 'bassOffset'>,
  key: MajorKey,
  bpm: number,
  instrument: string,
): PreviewRequest {
  return { midiNotes: chordMidiNotes(chord, key), velocity: 100, lengthBeats: 2, bpm, instrument };
}
