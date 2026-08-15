/**
 * Which native playback engine a request runs on — a diagnostic switch, never a
 * product setting.
 *
 * `sampled` is the legacy v1 path (pre-rendered buffers summed in a render callback).
 * `sequencer` is the fidelity path: the same `FinalMidiSnapshot`
 * flattened to NoteOn / NoteOff / CC64 and sent to a live `AVAudioUnitSampler`.
 * Do not add CC64 emulation to `sampled`.
 *
 * Sequencer is the safe default because sampled cannot satisfy the playback contract:
 * it drops CC64 and clamps notes above MIDI 84. The legacy engine remains an explicit,
 * reversible diagnostic override:
 *
 *   - build-time: `EXPO_PUBLIC_PLAYBACK_ENGINE=sampled`
 *   - runtime:   `setPlaybackEngineOverride('sampled')` from the dev listening
 *     screen, so one build can A/B the same Final MIDI back to back
 *
 * No UI outside the dev screen references this.
 */

import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import type { SessionPerformancePlan } from '@/lib/performance/finalMidi/types';
import { buildNativePlaybackPlan } from '@/lib/playback';
import type { PlaybackEngineId, PlaybackRequest } from './types';

const ENGINE_IDS: readonly PlaybackEngineId[] = ['sampled', 'sequencer'];

function normalize(value: string | undefined): PlaybackEngineId | null {
  const id = value?.trim() as PlaybackEngineId | undefined;
  return id && ENGINE_IDS.includes(id) ? id : null;
}

/** Build-time default. Anything unrecognised means the shipping engine. */
export function resolveBuildPlaybackEngine(value: string | undefined): PlaybackEngineId {
  return normalize(value) ?? 'sequencer';
}

const BUILD_DEFAULT = resolveBuildPlaybackEngine(process.env.EXPO_PUBLIC_PLAYBACK_ENGINE);

let override: PlaybackEngineId | null = null;

export function playbackEngineIds(): readonly PlaybackEngineId[] {
  return ENGINE_IDS;
}

/** The engine the next request will use. */
export function activePlaybackEngine(): PlaybackEngineId {
  return override ?? BUILD_DEFAULT;
}

/** Diagnostic-only. `null` restores the build-time default. */
export function setPlaybackEngineOverride(id: PlaybackEngineId | null): void {
  override = id;
}

/**
 * Attach what the realtime engine needs, derived from the SAME plan the v1 fields came
 * from. A no-op (identical object) only for the explicit legacy `sampled` override.
 */
export function withNativePlaybackPlan(
  request: PlaybackRequest,
  plan: SessionPerformancePlan,
): PlaybackRequest {
  const engine = activePlaybackEngine();
  if (engine !== 'sequencer') return request;

  const snapshot = buildFinalMidiSnapshot(plan);
  const native = buildNativePlaybackPlan(snapshot, {
    loop: request.loop,
    startBeat: request.startBeat,
  });
  return {
    ...request,
    engine,
    smfBase64: native.smfBase64,
    hasDrums: native.hasDrums,
    gmProgram: native.gmProgram,
    planSignature: native.signature,
    midiEvents: native.midiEvents,
  };
}
