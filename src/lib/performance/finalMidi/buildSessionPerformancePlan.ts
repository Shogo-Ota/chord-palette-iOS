/**
 * Single entry point for session → Performance Engine output.
 * Used by playback, video export, and MIDI export so generation never diverges.
 */

import { generatePerformance } from '../PerformanceEngine';
import { collisionProfileFor, shiftProfile, validateHarmonyCollisions } from '../harmonyCollision';
import { applyHarmonyGate } from '../harmonyGate';
import { humanTemplateById, humanTemplateIdForPattern } from '../humanTemplate';
import { remeterChords } from '../meter';
import { styleForRhythm } from '../model/styleCards';
import { progressionToPerfChords } from '../progressionInput';
import {
  applyInstrumentEffect,
  instrumentEffectFromReleaseCut,
  type InstrumentEffect,
} from '../effect';
import { beatsPerBarFor } from '../rhythms';
import { naturalPedalEvents } from '../naturalAtomic/pedalPolicy';
import { renderMaskedStyles, resolveEffectiveStyles, type EffectiveChordStyle } from '../style';
import { resolveDrumPatternId } from '@/lib/drum/resolveDrumPattern';
import { tierProfile, type Tier } from '../tier';
import type { VoicingPosition } from '../baseVoicing';
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
  /** @deprecated Fallback for callers predating per-chord `voicingPosition`. */
  voicingPosition?: VoicingPosition;
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
  humanTemplatePitchMode?: 'sharedBase' | 'userChord' | 'teacherFidelity';
};

/** Block is a plain held chord — never a Human MIDI Template. */
function humanTemplateIdFor(
  pattern: AccompanimentPattern,
  variantTemplateId: string | undefined,
): string | undefined {
  if (pattern === 'block') return undefined;
  return variantTemplateId ?? humanTemplateIdForPattern(pattern);
}

export function buildSessionPerformancePlan(
  session: PerformanceSessionInput,
  tier: Tier = 'free',
): SessionPerformancePlan {
  const beatsPerBar = beatsPerBarFor(session.accompanimentPattern);
  const authored = progressionToPerfChords(
    session.progression,
    session.key,
    session.octaveShift,
    session.voicingPosition ?? 'root',
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
  const resolvedVariant = resolveVariant(
    session.accompanimentPattern,
    session.accompanimentVariant,
  );
  const humanTemplateId = humanTemplateIdFor(
    session.accompanimentPattern,
    resolvedVariant.humanTemplateId,
  );
  // A chord may name its own STYLE; every other chord inherits the project's. One
  // render per distinct STYLE, each over the FULL progression, so phrase index and
  // absolute beat never depend on which STYLEs happen to neighbour a chord.
  const globalStyle: EffectiveChordStyle = {
    pattern: session.accompanimentPattern,
    variant: resolvedVariant.id,
  };
  const raw = renderMaskedStyles(
    resolveEffectiveStyles(session.progression, globalStyle),
    globalStyle,
    chords,
    (style) => {
      const variant = resolveVariant(style.pattern, style.variant);
      const styleTemplateId = humanTemplateIdFor(style.pattern, variant.humanTemplateId);
      const template = humanTemplateById(styleTemplateId ?? '');
      return {
        notes: generatePerformance(
          { chords, bpm: session.tempoBpm, seed },
          {
            styleId: style.pattern,
            variantId: variant.id,
            grooveId: session.grooveId,
            energy: session.accompanimentEnergy,
            accompanimentStyle: styleForRhythm(style.pattern) ?? 'band',
            drums: false,
            humanizeBoost: strength.humanizeBoost,
            strumScale: strength.strumScale,
            humanTemplateId: styleTemplateId,
            humanTemplatePitchMode: session.humanTemplatePitchMode,
          },
        ),
        controlChanges: template ? naturalPedalEvents(template, chords, variant.id) : [],
      };
    },
  );
  // Detect illegal pitches only — do not snap. Degree runtime must be judged as-is.
  const gated = applyHarmonyGate(raw.notes, chords);
  const effect = session.instrumentEffect ?? instrumentEffectFromReleaseCut(session.releaseCut);
  const notes = applyInstrumentEffect(gated.notes, effect);
  const controlChanges = effect === 'releaseCut' ? [] : raw.controlChanges;
  // Judged after the effect: sustain is what lengthens gates into one another, so
  // the notes that actually share air are only knowable here.
  const collisionReport = validateHarmonyCollisions(notes, chords, {
    profile: shiftProfile(collisionProfileFor(session.instrumentId), session.octaveShift),
    styleId: resolvedVariant.id,
    beatsPerBar,
  });

  return {
    notes,
    controlChanges,
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
    accompanimentVariant: resolvedVariant.id,
    humanTemplateId,
    seed,
    harmonyViolations: gated.violations,
    collisionReport,
  };
}
