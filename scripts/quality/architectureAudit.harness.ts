/**
 * PHASE A — accompaniment architecture audit (measurement half).
 *
 * Produces the numbers the written audit cites. It changes nothing: it renders the
 * Golden Progressions through the production plan and records what the product
 * actually does, for every public style and for both instrument effects.
 *
 * Run: npm run quality:audit
 * Out: LocalAnalysis/accompaniment_quality/audit_phase_a/
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import { buildStableFullVoicings } from '@/lib/performance/chordComping';
import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import { PUBLIC_ACCOMPANIMENT_PATTERNS } from '@/lib/performance/publicAccompaniment';
import { defaultVariantFor } from '@/lib/performance/variants';
import type { InstrumentEffect } from '@/lib/performance/effect';

import { GOLDEN_PROGRESSIONS } from './goldenProgressions';
import {
  grooveMetricsOf,
  pedalObservationOf,
  planFor,
  registerMetricsOf,
  round,
  voicingPerChord,
  type ChordVoicingObservation,
  type GrooveMetrics,
} from './measure';

const OUT_DIR = join(
  process.cwd(),
  'LocalAnalysis',
  'accompaniment_quality',
  'audit_phase_a',
);

const EFFECTS: readonly InstrumentEffect[] = ['off', 'sustain'];

type StyleRow = {
  progressionId: string;
  progressionName: string;
  pattern: string;
  variantId: string;
  effect: InstrumentEffect;
  groove: GrooveMetrics;
  register: ReturnType<typeof registerMetricsOf>;
  pedal: ReturnType<typeof pedalObservationOf>;
  harmonyViolations: number;
  voicing: ChordVoicingObservation[];
};

type InvarianceRow = {
  progressionId: string;
  chordIndex: number;
  symbol: string;
  /** pattern → sounding pitch set inside that chord's window. */
  byPattern: Record<string, number[]>;
  identicalPitches: boolean;
  identicalPitchClasses: boolean;
  identicalBass: boolean;
  identicalTop: boolean;
  maxBassSpreadSemitones: number;
  maxTopSpreadSemitones: number;
};

type BaseVoicingRow = {
  progressionId: string;
  chordIndex: number;
  symbol: string;
  /** `progressionToChordSpecs` output — the engine Block/Variation read. */
  voiceLedPitches: number[];
  /** `buildStableFullVoicings` output — the engine City reads. */
  compactPitches: number[];
  identical: boolean;
  bassDelta: number;
  topDelta: number;
};

describe('PHASE A — accompaniment architecture audit', () => {
  const styleRows: StyleRow[] = [];
  const invariance: InvarianceRow[] = [];
  const baseVoicing: BaseVoicingRow[] = [];

  beforeAll(() => {
    mkdirSync(OUT_DIR, { recursive: true });

    for (const progression of GOLDEN_PROGRESSIONS) {
      // 1. Per-style production observation, at both effects. `off` is the identity
      // render, so it doubles as the written-length reference for the pedal check.
      for (const pattern of PUBLIC_ACCOMPANIMENT_PATTERNS) {
        const variantId = defaultVariantFor(pattern).id;
        const reference = planFor({ progression, pattern, variantId, effect: 'off', tier: 'free' });
        for (const effect of EFFECTS) {
          const plan =
            effect === 'off'
              ? reference
              : planFor({ progression, pattern, variantId, effect, tier: 'free' });
          const voicing = voicingPerChord(plan);
          styleRows.push({
            progressionId: progression.id,
            progressionName: progression.name,
            pattern,
            variantId,
            effect,
            groove: grooveMetricsOf(plan),
            register: registerMetricsOf(voicing),
            pedal: pedalObservationOf(plan, reference),
            harmonyViolations: plan.harmonyViolations?.length ?? 0,
            voicing,
          });
        }
      }

      // 2. Style pitch invariance (§29): same chords, same settings, styles differ.
      const perPattern = new Map<string, ChordVoicingObservation[]>();
      for (const pattern of PUBLIC_ACCOMPANIMENT_PATTERNS) {
        const plan = planFor({
          progression,
          pattern,
          variantId: defaultVariantFor(pattern).id,
          effect: 'off',
          tier: 'free',
        });
        perPattern.set(pattern, voicingPerChord(plan));
      }
      const chordCount = Math.max(...[...perPattern.values()].map((v) => v.length));
      for (let chordIndex = 0; chordIndex < chordCount; chordIndex += 1) {
        const byPattern: Record<string, number[]> = {};
        const basses: number[] = [];
        const tops: number[] = [];
        let symbol = '?';
        for (const [pattern, observations] of perPattern) {
          const observation = observations[chordIndex];
          if (!observation) continue;
          symbol = observation.symbol;
          byPattern[pattern] = observation.pitches;
          if (observation.bass != null) basses.push(observation.bass);
          if (observation.top != null) tops.push(observation.top);
        }
        const sets = Object.values(byPattern).map((p) => p.join(','));
        const pcSets = Object.values(byPattern).map((p) =>
          [...new Set(p.map((n) => ((n % 12) + 12) % 12))].sort((a, b) => a - b).join(','),
        );
        invariance.push({
          progressionId: progression.id,
          chordIndex,
          symbol,
          byPattern,
          identicalPitches: new Set(sets).size <= 1,
          identicalPitchClasses: new Set(pcSets).size <= 1,
          identicalBass: new Set(basses).size <= 1,
          identicalTop: new Set(tops).size <= 1,
          maxBassSpreadSemitones: basses.length ? Math.max(...basses) - Math.min(...basses) : 0,
          maxTopSpreadSemitones: tops.length ? Math.max(...tops) - Math.min(...tops) : 0,
        });
      }

      // 3. Shared Base and the degree-tagged mask adapter must be pitch-identical.
      const perfChords = progressionToPerfChords(progression.chords, progression.key, 0);
      const compact = buildStableFullVoicings(perfChords);
      perfChords.forEach((chord, chordIndex) => {
        const voiceLed = [...chord.bassMidi, ...chord.bodyMidi].sort((a, b) => a - b);
        const compactPitches = (compact.find((v) => v.chordIndex === chordIndex)?.notes ?? [])
          .map((n) => n.pitch)
          .sort((a, b) => a - b);
        baseVoicing.push({
          progressionId: progression.id,
          chordIndex,
          symbol: chord.harmony?.symbol ?? '?',
          voiceLedPitches: voiceLed,
          compactPitches,
          identical: voiceLed.join(',') === compactPitches.join(','),
          bassDelta:
            voiceLed.length && compactPitches.length ? compactPitches[0]! - voiceLed[0]! : 0,
          topDelta:
            voiceLed.length && compactPitches.length
              ? compactPitches[compactPitches.length - 1]! - voiceLed[voiceLed.length - 1]!
              : 0,
        });
      });
    }

    writeFileSync(
      join(OUT_DIR, 'style_observations.json'),
      `${JSON.stringify(styleRows, null, 2)}\n`,
    );
    writeFileSync(
      join(OUT_DIR, 'style_pitch_invariance.json'),
      `${JSON.stringify(invariance, null, 2)}\n`,
    );
    writeFileSync(
      join(OUT_DIR, 'base_voicing_engines.json'),
      `${JSON.stringify(baseVoicing, null, 2)}\n`,
    );
  });

  it('records the production observation for every public style × golden progression', () => {
    expect(styleRows.length).toBe(
      GOLDEN_PROGRESSIONS.length * PUBLIC_ACCOMPANIMENT_PATTERNS.length * EFFECTS.length,
    );
    for (const row of styleRows) {
      expect(row.groove.attackGroups).toBeGreaterThan(0);
    }
  });

  it('reports the measured effect of the shipping `sustain` effect on gate and rest', () => {
    const summary = styleRows
      .filter((r) => r.effect === 'off')
      .map((off) => {
        const on = styleRows.find(
          (r) =>
            r.effect === 'sustain' &&
            r.pattern === off.pattern &&
            r.progressionId === off.progressionId,
        )!;
        return {
          progressionId: off.progressionId,
          pattern: off.pattern,
          gateBeatsOff: off.groove.meanGateBeats,
          gateBeatsSustain: on.groove.meanGateBeats,
          gateRatio: off.groove.meanGateBeats
            ? round(on.groove.meanGateBeats / off.groove.meanGateBeats)
            : 0,
          restRateOff: off.groove.restRate,
          restRateSustain: on.groove.restRate,
          soundingRatioOff: off.groove.soundingRatio,
          soundingRatioSustain: on.groove.soundingRatio,
          overlapsOff: off.groove.overlappingAttacks,
          overlapsSustain: on.groove.overlappingAttacks,
          cc64Sustain: on.pedal.cc64Events,
          doubleSustain: on.pedal.doubleSustain,
        };
      });
    writeFileSync(
      join(OUT_DIR, 'gate_rest_effect_impact.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
    );
     
    console.log('GATE/REST IMPACT OF SHIPPING `sustain`:\n', JSON.stringify(summary, null, 2));
    expect(summary.length).toBeGreaterThan(0);
  });

  it('reports style pitch invariance across Block / Natural / City', () => {
    const failing = invariance.filter((row) => !row.identicalPitches);
    const summary = {
      chordsCompared: invariance.length,
      identicalPitches: invariance.length - failing.length,
      identicalPitchClassesOnly: invariance.filter(
        (r) => !r.identicalPitches && r.identicalPitchClasses,
      ).length,
      identicalBass: invariance.filter((r) => r.identicalBass).length,
      identicalTop: invariance.filter((r) => r.identicalTop).length,
      maxBassSpreadSemitones: Math.max(0, ...invariance.map((r) => r.maxBassSpreadSemitones)),
      maxTopSpreadSemitones: Math.max(0, ...invariance.map((r) => r.maxTopSpreadSemitones)),
    };
    writeFileSync(
      join(OUT_DIR, 'style_pitch_invariance_summary.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
    );
     
    console.log('STYLE PITCH INVARIANCE:\n', JSON.stringify(summary, null, 2));
    expect(invariance.length).toBeGreaterThan(0);
  });

  it('reports how far the two base-voicing engines disagree', () => {
    const summary = {
      chordsCompared: baseVoicing.length,
      identical: baseVoicing.filter((r) => r.identical).length,
      maxAbsBassDelta: Math.max(0, ...baseVoicing.map((r) => Math.abs(r.bassDelta))),
      maxAbsTopDelta: Math.max(0, ...baseVoicing.map((r) => Math.abs(r.topDelta))),
    };
    writeFileSync(
      join(OUT_DIR, 'base_voicing_engines_summary.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
    );
     
    console.log('BASE VOICING ENGINE DIVERGENCE:\n', JSON.stringify(summary, null, 2));
    expect(baseVoicing.length).toBeGreaterThan(0);
  });

  it('reports harmony legality across the golden set', () => {
    const violations = styleRows.filter((r) => r.harmonyViolations > 0);
    const summary = {
      casesRendered: styleRows.length,
      casesWithIllegalPitch: violations.length,
      detail: violations.map((r) => ({
        progressionId: r.progressionId,
        pattern: r.pattern,
        effect: r.effect,
        count: r.harmonyViolations,
      })),
    };
    writeFileSync(join(OUT_DIR, 'harmony_legality.json'), `${JSON.stringify(summary, null, 2)}\n`);
     
    console.log('HARMONY LEGALITY:\n', JSON.stringify(summary, null, 2));
    expect(summary.casesRendered).toBeGreaterThan(0);
  });
});
