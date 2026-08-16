/**
 * EXPERIMENT gate-01 — one quality category: GATE.
 *
 * Hypothesis: the shipping `sustain` effect realizes "the piano rings" by
 * multiplying every note length by 2.0. That erases the gate / gap / rest
 * structure both Natural and City were designed and listening-approved with, and
 * for Natural it stacks on top of the teacher's own CC64 (double sustain).
 * Letting CC64 alone create the ring should restore the intended groove without
 * touching a single pitch.
 *
 * A = baseline   : instrumentEffect 'sustain'  (what production ships today)
 * B = candidate  : instrumentEffect 'off'      (written lengths kept, CC64 rings)
 *
 * Nothing in `src/` is modified by this harness — both arms are rendered by
 * passing the effect explicitly, so the comparison is measured before any
 * production default changes.
 *
 * DECIDED: KEEP. `sustain` no longer stretches lengths, so both arms now render
 * identically and `baseline/` on disk is the historical pre-change artifact —
 * re-running this harness overwrites it. Kept as the record of how the decision was
 * measured, not as a live comparison.
 *
 * Run: npm run quality:gate01
 * Out: LocalAnalysis/accompaniment_quality/experiments/gate-01/
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import { writeSmf } from '@/lib/midiExport';
import { analyzePlaybackFidelity } from '@/lib/performance/analysis/playbackFidelity';
import { PUBLIC_ACCOMPANIMENT_PATTERNS } from '@/lib/performance/publicAccompaniment';
import { defaultVariantFor } from '@/lib/performance/variants';
import { validateCase } from '@/lib/midiQa/validate';
import type { InstrumentEffect } from '@/lib/performance/effect';
import type { QaProgressionId } from '@/lib/midiQa/progressions';

import { GOLDEN_PROGRESSIONS } from './goldenProgressions';
import {
  grooveMetricsOf,
  pedalObservationOf,
  planFor,
  registerMetricsOf,
  round,
  voicingPerChord,
  type GrooveMetrics,
} from './measure';

const ROOT = join(
  process.cwd(),
  'LocalAnalysis',
  'accompaniment_quality',
  'experiments',
  'gate-01',
);

type ArmId = 'A-baseline-sustain' | 'B-candidate-pedal-only';

const ARMS: readonly { id: ArmId; effect: InstrumentEffect; dir: string }[] = [
  { id: 'A-baseline-sustain', effect: 'sustain', dir: 'baseline' },
  { id: 'B-candidate-pedal-only', effect: 'off', dir: join('candidates', 'pedal-only') },
];

type CaseRow = {
  arm: ArmId;
  caseId: string;
  progressionId: string;
  progressionName: string;
  pattern: string;
  variantId: string;
  effect: InstrumentEffect;
  groove: GrooveMetrics;
  register: ReturnType<typeof registerMetricsOf>;
  pedal: ReturnType<typeof pedalObservationOf>;
  harmonyViolations: number;
  midiQaPass: boolean;
  midiQaFailures: string[];
  clampedPitchNotes: number;
  longestNoteSeconds: number;
  noteCount: number;
  pitchSignature: string;
};

describe('EXPERIMENT gate-01 — sustain realization (GATE category)', () => {
  const rows: CaseRow[] = [];

  beforeAll(() => {
    for (const arm of ARMS) {
      mkdirSync(join(ROOT, arm.dir), { recursive: true });
    }

    for (const progression of GOLDEN_PROGRESSIONS) {
      for (const pattern of PUBLIC_ACCOMPANIMENT_PATTERNS) {
        const variantId = defaultVariantFor(pattern).id;
        // The `off` arm is also the written-length reference for the pedal check.
        const reference = planFor({ progression, pattern, variantId, effect: 'off', tier: 'free' });
        for (const arm of ARMS) {
          const plan = planFor({
            progression,
            pattern,
            variantId,
            effect: arm.effect,
            tier: 'free',
          });
          const snapshot = buildFinalMidiSnapshot(plan);
          const caseId = `${progression.id}__${pattern}__${variantId}`;
          writeFileSync(join(ROOT, arm.dir, `${caseId}.mid`), Buffer.from(writeSmf(snapshot)));

          const voicing = voicingPerChord(plan);
          const verdict = validateCase(
            caseId,
            pattern,
            variantId,
            progression.id as QaProgressionId,
            snapshot,
            plan,
          );
          const fidelity = analyzePlaybackFidelity(plan.notes, plan.bpm);

          rows.push({
            arm: arm.id,
            caseId,
            progressionId: progression.id,
            progressionName: progression.name,
            pattern,
            variantId,
            effect: arm.effect,
            groove: grooveMetricsOf(plan),
            register: registerMetricsOf(voicing),
            pedal: pedalObservationOf(plan, reference),
            harmonyViolations: plan.harmonyViolations?.length ?? 0,
            midiQaPass: verdict.pass,
            midiQaFailures: verdict.analysis.failures.map((f) => f.code),
            clampedPitchNotes: fidelity.clampedPitchNotes,
            longestNoteSeconds: round(fidelity.longestNoteSeconds, 3),
            noteCount: plan.notes.length,
            // Pitch must be byte-identical between arms: this experiment changes
            // only how long notes are held.
            pitchSignature: plan.notes
              .map((n) => `${round(n.timeBeat, 5)}:${n.pitch}:${n.velocity}`)
              .join('|'),
          });
        }
      }
    }
  });

  it('changes no pitch, onset, velocity or note count (single-category discipline)', () => {
    const drift: string[] = [];
    for (const baseline of rows.filter((r) => r.arm === 'A-baseline-sustain')) {
      const candidate = rows.find(
        (r) => r.arm === 'B-candidate-pedal-only' && r.caseId === baseline.caseId,
      )!;
      if (candidate.pitchSignature !== baseline.pitchSignature) drift.push(baseline.caseId);
      expect(candidate.noteCount).toBe(baseline.noteCount);
    }
    expect(drift).toEqual([]);
  });

  it('keeps every hard gate green in both arms', () => {
    const report = {
      cases: rows.length,
      byArm: ARMS.map((arm) => {
        const armRows = rows.filter((r) => r.arm === arm.id);
        return {
          arm: arm.id,
          illegalPitchClassCases: armRows.filter((r) => r.harmonyViolations > 0).length,
          midiQaFailingCases: armRows.filter((r) => !r.midiQaPass).length,
          midiQaFailureCodes: [...new Set(armRows.flatMap((r) => r.midiQaFailures))].sort(),
          clampedPitchNotes: armRows.reduce((sum, r) => sum + r.clampedPitchNotes, 0),
          doubleSustainCases: armRows.filter((r) => r.pedal.doubleSustain).length,
          maxOctaveJumps: Math.max(0, ...armRows.map((r) => r.register.octaveJumps)),
        };
      }),
    };
    writeFileSync(join(ROOT, 'hard_gate.json'), `${JSON.stringify(report, null, 2)}\n`);
     
    console.log('HARD GATE:\n', JSON.stringify(report, null, 2));
    for (const arm of report.byArm) {
      expect(arm.illegalPitchClassCases).toBe(0);
      expect(arm.clampedPitchNotes).toBe(0);
    }
  });

  it('measures the groove delta and records the decision', () => {
    const comparison = rows
      .filter((r) => r.arm === 'A-baseline-sustain')
      .map((baseline) => {
        const candidate = rows.find(
          (r) => r.arm === 'B-candidate-pedal-only' && r.caseId === baseline.caseId,
        )!;
        return {
          caseId: baseline.caseId,
          pattern: baseline.pattern,
          meanGateBeats: { a: baseline.groove.meanGateBeats, b: candidate.groove.meanGateBeats },
          meanGapBeats: {
            a: baseline.groove.meanGapToNextAttackBeats,
            b: candidate.groove.meanGapToNextAttackBeats,
          },
          restRate: { a: round(baseline.groove.restRate), b: round(candidate.groove.restRate) },
          soundingRatio: {
            a: round(baseline.groove.soundingRatio),
            b: round(candidate.groove.soundingRatio),
          },
          overlappingAttacks: {
            a: baseline.groove.overlappingAttacks,
            b: candidate.groove.overlappingAttacks,
          },
          cc64: { a: baseline.pedal.cc64Events, b: candidate.pedal.cc64Events },
          doubleSustain: { a: baseline.pedal.doubleSustain, b: candidate.pedal.doubleSustain },
        };
      });

    const perPattern = PUBLIC_ACCOMPANIMENT_PATTERNS.map((pattern) => {
      const cases = comparison.filter((c) => c.pattern === pattern);
      const avg = (pick: (c: (typeof cases)[number]) => number) =>
        round(cases.reduce((sum, c) => sum + pick(c), 0) / Math.max(1, cases.length));
      return {
        pattern,
        restRate: { a: avg((c) => c.restRate.a), b: avg((c) => c.restRate.b) },
        soundingRatio: { a: avg((c) => c.soundingRatio.a), b: avg((c) => c.soundingRatio.b) },
        overlappingAttacks: {
          a: avg((c) => c.overlappingAttacks.a),
          b: avg((c) => c.overlappingAttacks.b),
        },
        doubleSustainCases: {
          a: cases.filter((c) => c.doubleSustain.a).length,
          b: cases.filter((c) => c.doubleSustain.b).length,
        },
      };
    });

    writeFileSync(
      join(ROOT, 'metrics.json'),
      `${JSON.stringify({ perPattern, comparison, rows }, null, 2)}\n`,
    );
     
    console.log('GROOVE DELTA (A=sustain, B=pedal-only):\n', JSON.stringify(perPattern, null, 2));

    // Candidate B must restore silence and remove the double sustain everywhere.
    for (const pattern of perPattern) {
      expect(pattern.soundingRatio.b).toBeLessThanOrEqual(pattern.soundingRatio.a);
      expect(pattern.overlappingAttacks.b).toBeLessThanOrEqual(pattern.overlappingAttacks.a);
      expect(pattern.doubleSustainCases.b).toBe(0);
    }
  });

  it('records the playback contract observation', () => {
    const report = ARMS.map((arm) => {
      const armRows = rows.filter((r) => r.arm === arm.id);
      return {
        arm: arm.id,
        engine: 'sequencer',
        clampedPitchNotes: armRows.reduce((sum, r) => sum + r.clampedPitchNotes, 0),
        longestNoteSeconds: Math.max(0, ...armRows.map((r) => r.longestNoteSeconds)),
        cc64Written: armRows.reduce((sum, r) => sum + r.pedal.cc64Events, 0),
      };
    });
    writeFileSync(join(ROOT, 'playback.json'), `${JSON.stringify(report, null, 2)}\n`);
     
    console.log('PLAYBACK:\n', JSON.stringify(report, null, 2));
    expect(report.length).toBe(2);
  });
});
