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
import { applyReleaseCut } from '@/lib/performance/releaseCut';
import { tierProfile, type Tier } from '@/lib/performance/tier';
import { voicingAestheticFor } from '@/lib/performance/voiceLeading';
import { buildPresetProgression } from '@/lib/presets';
import { chordMidiNotes } from '@/lib/voicing';
import {
  mapPerfNotesToPlaybackRequest,
  performanceSeedFromSession,
} from '@/services/audio/performanceMapper';
import type { PlaybackRequest, PreviewRequest } from '@/services/audio/types';
import type { ChordEvent, MajorKey, Preset } from '@/types';
import type { EditorSession } from './session';

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
  const chords = progressionToPerfChords(
    session.progression,
    session.key,
    session.octaveShift,
    voicingAestheticFor(session.accompanimentPattern, tier),
  );
  const totalBeats = chords.reduce(
    (max, c) => Math.max(max, c.startBeat + c.durationBeats),
    0,
  );
  const seed = performanceSeedFromSession({
    key: session.key,
    tempoBpm: session.tempoBpm,
    grooveId: session.grooveId,
    accompanimentPattern: session.accompanimentPattern,
    accompanimentVariant: session.accompanimentVariant,
    instrumentId: session.instrumentId,
    progression: session.progression,
  });
  const strength = tierProfile(tier);
  const raw = generatePerformance(
    { chords, bpm: session.tempoBpm, seed },
    // Native DrumProvider owns the groove; do not emit PE drum tracks. The groove
    // id gives the Feel layer its resolution context (which base skeleton to use).
    {
      styleId: session.accompanimentPattern,
      variantId: session.accompanimentVariant,
      grooveId: session.grooveId,
      drums: false,
      humanizeBoost: strength.humanizeBoost,
      strumScale: strength.strumScale,
    },
  );
  const notes = applyReleaseCut(raw, session.releaseCut);
  const request = mapPerfNotesToPlaybackRequest(notes, {
    bpm: session.tempoBpm,
    totalBeats,
    loop,
    drumPatternId: session.grooveId,
    instrument: session.instrumentId,
  });

  return request;
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
