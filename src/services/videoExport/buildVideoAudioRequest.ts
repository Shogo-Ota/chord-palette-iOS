/**
 * Builds the video renderer payload from the canonical Final MIDI snapshot.
 *
 * The legacy chord-event fields stay populated for older native binaries, but
 * current binaries must prefer `midiEvents`: they are the exact NoteOn, NoteOff
 * and CC messages used by shipping realtime playback.
 */

import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import type { SessionPerformancePlan } from '@/lib/performance/finalMidi/types';
import { buildNativePlaybackPlan } from '@/lib/playback';
import { mapPerfNotesToPlaybackRequest } from '@/services/audio/performanceMapper';
import type { RenderAudioRequest } from '@/services/audio/types';

export function buildVideoAudioRequest(
  performance: SessionPerformancePlan,
  durationSec: number,
): RenderAudioRequest {
  const legacy = mapPerfNotesToPlaybackRequest(performance.notes, {
    bpm: performance.bpm,
    totalBeats: performance.totalBeats,
    loop: true,
    drumPatternId: performance.drumPatternId,
    instrument: performance.instrumentId,
    beatsPerBar: performance.beatsPerBar,
    drumMode: performance.drumMode,
  });
  const snapshot = buildFinalMidiSnapshot(performance);
  const native = buildNativePlaybackPlan(snapshot, { loop: false });

  return {
    bpm: native.bpm,
    totalBeats: native.totalBeats,
    chordEvents: legacy.chordEvents,
    drumPatternId: legacy.drumPatternId,
    accompaniment: legacy.accompaniment,
    instrument: native.instrument,
    durationSec,
    beatsPerBar: legacy.beatsPerBar,
    drumMode: legacy.drumMode,
    midiEvents: native.midiEvents,
    hasDrums: native.hasDrums,
    gmProgram: native.gmProgram,
    planSignature: native.signature,
  };
}
