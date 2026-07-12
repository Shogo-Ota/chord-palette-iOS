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
    // Phase 2A native plays a single synth pattern regardless of id; the real
    // groove id is forwarded so Phase 2B can map it to a sampled pattern.
    drumPatternId: session.grooveId,
  };
}

/** Single-chord audition for a library/timeline tap. */
export function chordPreviewRequest(
  chord: Pick<ChordEvent, 'rootOffset' | 'suffix' | 'bassOffset'>,
  key: MajorKey,
  bpm: number,
): PreviewRequest {
  return { midiNotes: chordMidiNotes(chord, key), velocity: 100, lengthBeats: 2, bpm };
}
