/**
 * Bridges the editor session to the audio engine via the Performance Engine
 * (sprint-6 Step 3). Pure and side-effect free — the screen calls AudioService
 * with the resulting PlaybackRequest.
 *
 * Chord/bass rhythm, velocity, microtiming and gate come from `generatePerformance`.
 * Native accompaniment is set to `'performance'` (1:1, no re-humanize). Drums stay
 * on the native groove id so PE drum tracks are not double-played — except when the
 * chosen rhythm owns the meter or hop, in which case the drum pattern follows it.
 */

import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { countInForStart } from '@/lib/playback';
import { buildPresetProgression } from '@/lib/presets';
import { chordMidiNotes } from '@/lib/voicing';
import { mapPerfNotesToPlaybackRequest } from '@/services/audio/performanceMapper';
import { withNativePlaybackPlan } from '@/services/audio/playbackEngine';
import type { PlaybackRequest, PreviewRequest } from '@/services/audio/types';
import type { ChordEvent, MajorKey, Preset } from '@/types';
import type { Tier } from '@/lib/performance/tier';
import type { EditorSession } from './session';

export { beatsPerBarFor } from '@/lib/performance/rhythms';
export { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';

/**
 * Build the full playback request for the current session.
 *
 * `tier` (monetization) scales the humanize/strum strength — `free` (default) is the
 * exact pre-tier behaviour (no regression); `pro` breathes a little more (see tier.ts).
 * The screen/hook reads the entitlement and passes the tier; this stays a pure function.
 */
export function sessionToPlaybackRequest(
  session: EditorSession,
  loop: boolean,
  tier: Tier = 'free',
): PlaybackRequest {
  const plan = buildSessionPerformancePlan(session, tier);
  const request = mapPerfNotesToPlaybackRequest(plan.notes, {
    bpm: plan.bpm,
    totalBeats: plan.totalBeats,
    loop,
    drumPatternId: plan.drumPatternId,
    instrument: plan.instrumentId,
    beatsPerBar: plan.beatsPerBar,
    drumMode: plan.drumMode,
  });
  // The only place both the plan and the request exist, so the realtime engine's
  // payload is derived here rather than rebuilt from the request downstream.
  // Returns `request` untouched unless the diagnostic engine switch is on.
  return withNativePlaybackPlan(request, plan);
}

/** Normal editor transport starts with one four-count; all other callers stay unchanged. */
export function editorPlaybackRequest(
  session: EditorSession,
  loop: boolean,
  tier: Tier = 'free',
): PlaybackRequest {
  return {
    ...sessionToPlaybackRequest(session, loop, tier),
    countIn: countInForStart(),
  };
}

/**
 * Build a playback request that auditions a PRESET in full, rendered in the current
 * session's key with its groove / accompaniment / instrument / tempo. Used for the
 * free "preview-only" (試聴) path on Pro presets: the progression is heard exactly as
 * it would sound, without loading it into (i.e. mutating) the editor session. Pure.
 */
export function presetPlaybackRequest(
  preset: Preset,
  session: EditorSession,
  loop = false,
  tier: Tier = 'free',
): PlaybackRequest {
  const progression: ChordEvent[] = buildPresetProgression(preset, session.key).map((e, i) => ({
    ...e,
    id: `preview-${i}`,
  }));
  return sessionToPlaybackRequest({ ...session, progression, selected: -1 }, loop, tier);
}

/** Single-chord audition for a library/timeline tap (context-free voicing). */
export function chordPreviewRequest(
  chord: Pick<ChordEvent, 'rootOffset' | 'suffix' | 'bassOffset'>,
  key: MajorKey,
  bpm: number,
  instrument: string,
  octaveShift = 0,
): PreviewRequest {
  const midiNotes = chordMidiNotes(chord, key, octaveShift);
  return { midiNotes, velocity: 100, lengthBeats: 2, bpm, instrument };
}
