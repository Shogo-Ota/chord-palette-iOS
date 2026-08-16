/**
 * Single entry point for session → Performance Engine output.
 * Used by playback, video export, and MIDI export so generation never diverges.
 */

import { generatePerformance } from '../PerformanceEngine';
import { applyHarmonyGate } from '../harmonyGate';
import { humanTemplateIdForPattern } from '../humanTemplate';
import { remeterChords } from '../meter';
import { styleForRhythm } from '../model/styleCards';
import { progressionToPerfChords } from '../progressionInput';
import {
  applyInstrumentEffect,
  instrumentEffectFromReleaseCut,
  type InstrumentEffect,
} from '../effect';
import { beatsPerBarFor } from '../rhythms';
import { resolveDrumPatternId } from '@/lib/drum/resolveDrumPattern';
import { tierProfile, type Tier } from '../tier';
import { voicingAestheticFor } from '../voiceLeading';
import { performanceSeedFromSession } from '@/services/audio/performanceMapper';
import type { DrumBeat } from '@/lib/drum/drumBeat';
import type { DrumMode } from '@/lib/drum/drumMode';
import type { AccompanimentEnergy } from '@/lib/performance/energy';
import { resolveVariant, type AccompanimentVariantId } from '@/lib/performance/variants';
import type { AccompanimentPattern, ChordEvent, InstrumentId, MajorKey } from '@/types';
import type { SessionPerformancePlan } from './types';

/** Minimal session fields required to render performance — domain layer only. */
export type PerformanceSessionInput = {
  key: MajorKey;
  tempoBpm: number;
  grooveId: string;
  accompanimentPattern: AccompanimentPattern;
  accompanimentVariant?: AccompanimentVariantId;
  instrumentId: InstrumentId;
  accompanimentEnergy: AccompanimentEnergy;
  octaveShift: number;
  releaseCut: boolean;
  /** Piano effect. Omitted = derived from the legacy `releaseCut` flag. */
  instrumentEffect?: InstrumentEffect;
  drumMode: DrumMode;
  /** Drum subdivision. Omitted = the 8th-note kit (pre-v1.02 behaviour). */
  drumBeat?: DrumBeat;
  progression: ChordEvent[];
  /**
   * Test-only. Production never sets this. `teacherFidelity` keeps Phase 1 / 2
   * Identity and Pure Transpose as low-level regression gates.
   */
  humanTemplatePitchMode?: 'userChord' | 'teacherFidelity';
};

export function buildSessionPerformancePlan(
  session: PerformanceSessionInput,
  tier: Tier = 'free',
): SessionPerformancePlan {
  const beatsPerBar = beatsPerBarFor(session.accompanimentPattern);
  const authored = progressionToPerfChords(
    session.progression,
    session.key,
    session.octaveShift,
    voicingAestheticFor(session.accompanimentPattern, tier),
  );
  const chords = remeterChords(authored, beatsPerBar);
  const totalBeats = chords.reduce((max, c) => Math.max(max, c.startBeat + c.durationBeats), 0);
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
  // The chosen Type names its own teacher take; a project saved before Types existed
  // falls back to the take its rhythm always played.
  // Block is a plain held chord — never a Human MIDI Template.
  const humanTemplateId =
    session.accompanimentPattern === 'block'
      ? undefined
      : (resolveVariant(session.accompanimentPattern, session.accompanimentVariant)
          .humanTemplateId ?? humanTemplateIdForPattern(session.accompanimentPattern));
  const raw = generatePerformance(
    { chords, bpm: session.tempoBpm, seed },
    {
      styleId: session.accompanimentPattern,
      variantId: session.accompanimentVariant,
      grooveId: session.grooveId,
      energy: session.accompanimentEnergy,
      accompanimentStyle: styleForRhythm(session.accompanimentPattern) ?? 'band',
      drums: false,
      humanizeBoost: strength.humanizeBoost,
      strumScale: strength.strumScale,
      humanTemplateId,
      humanTemplatePitchMode: session.humanTemplatePitchMode,
    },
  );
  // Detect illegal pitches only — do not snap. Degree runtime must be judged as-is.
  const gated = applyHarmonyGate(raw, chords);
  const effect = session.instrumentEffect ?? instrumentEffectFromReleaseCut(session.releaseCut);
  const notes = applyInstrumentEffect(gated.notes, effect);

  return {
    notes,
    chords,
    progression: session.progression,
    bpm: session.tempoBpm,
    totalBeats,
    beatsPerBar,
    drumPatternId: resolveDrumPatternId({
      grooveId: session.grooveId,
      accompanimentPattern: session.accompanimentPattern,
      drumBeat: session.drumBeat,
      drumMode: session.drumMode,
    }),
    instrumentId: session.instrumentId,
    drumMode: session.drumMode,
    instrumentEffect: effect,
    humanTemplateId,
    seed,
    harmonyViolations: gated.violations,
  };
}
