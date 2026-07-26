/**
 * Bridges the editor session to the audio engine: turns the current composition
 * (progression + key + tempo + groove) into the generic {@link PlaybackRequest}
 * the native engine consumes. Pure and side-effect free — the screen calls the
 * AudioService with the result.
 *
 * Piano accompaniment strikes and drum hits are precompiled by the TS Groove
 * Engine and attached as beat-level {@link PlaybackRequest.chordStrikes} /
 * {@link PlaybackRequest.drumHits}. Older native builds ignore the fields and
 * expand patterns themselves (NativeGrooveBridge.md).
 */

import { buildChordStrikesPayload, buildDrumHitsPayload } from '@/lib/groove/attachStrikes';
import { chordMidiNotes, progressionToChordSpecs } from '@/lib/voicing';
import { buildProgression } from '@/services/audio/schedule';
import type { PlaybackRequest, PreviewRequest } from '@/services/audio/types';
import type { ChordEvent, MajorKey } from '@/types';
import type { EditorSession } from './session';

/** Build the full playback request for the current session. */
export function sessionToPlaybackRequest(session: EditorSession, loop: boolean): PlaybackRequest {
  const specs = progressionToChordSpecs(session.progression, session.key);
  const { chordEvents, totalBeats } = buildProgression(specs);
  const chordStrikes = buildChordStrikesPayload({
    bpm: session.tempoBpm,
    totalBeats,
    chordEvents,
    accompaniment: session.accompanimentPattern,
    grooveId: session.grooveId,
  });
  const drumHits = buildDrumHitsPayload({ grooveId: session.grooveId });
  return {
    bpm: session.tempoBpm,
    totalBeats,
    loop,
    chordEvents,
    drumPatternId: session.grooveId,
    accompaniment: session.accompanimentPattern,
    instrument: session.instrumentId,
    chordStrikes,
    drumHits,
  };
}

/** Single-chord audition for a library/timeline tap. */
export function chordPreviewRequest(
  chord: Pick<ChordEvent, 'rootOffset' | 'suffix' | 'bassOffset' | 'definitionId'>,
  key: MajorKey,
  bpm: number,
  instrument: string,
): PreviewRequest {
  return { midiNotes: chordMidiNotes(chord, key), velocity: 100, lengthBeats: 2, bpm, instrument };
}
