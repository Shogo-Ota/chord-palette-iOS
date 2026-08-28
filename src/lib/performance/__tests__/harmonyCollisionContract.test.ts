/**
 * The collision contract of the shipping accompaniment, held per variant.
 *
 * This file used to record debt. Under `compact.v1` the approved output carried 87
 * close minor seconds; `compact.v3` (approved by ear 2026-08-28) rejects them at the
 * candidate stage, so every variant now audits clean and the fixture is a wall of
 * empty objects. That emptiness is the point: any future change that reintroduces a
 * collision shows up here as a named rule with a count, which is far more legible
 * than a changed digest.
 *
 * The fixture and the contract assertion are deliberately both kept. The fixture says
 * *which* rule moved and by how much; the contract says the report holds no reject at
 * all. A change that trades one rule for another would satisfy neither.
 *
 * Regenerate with `WRITE_HARMONY_COLLISION_DEBT=1`, then run prettier on the fixture
 * and rerun without the flag (the write pass compares against the file it just
 * overwrote and is expected to fail).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import expected from '@/lib/performance/__tests__/fixtures/harmonyCollisionContract.json';
import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { PerformanceSessionInput } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { HarmonyCollisionRuleId } from '@/lib/performance/harmonyCollision';
import { PUBLIC_ACCOMPANIMENT_PATTERNS } from '@/lib/performance/publicAccompaniment';
import { offeredVariantsFor } from '@/lib/performance/variants';

/** Rules that were already clean under v1 and must stay clean. A hit here is a bug. */
const ZERO_TOLERANCE: HarmonyCollisionRuleId[] = [
  'NON_CHORD_TONE',
  'INSTRUMENT_RANGE',
  'LOW_INTERVAL_LIMIT',
  'DUPLICATE_NOTE',
];

type Counts = Partial<Record<HarmonyCollisionRuleId, number>>;
type Progression = (typeof GOLDEN_PROGRESSIONS)[number];

function sessionFor(
  pattern: PerformanceSessionInput['accompanimentPattern'],
  variantId: PerformanceSessionInput['accompanimentVariant'],
  progression: Progression,
): PerformanceSessionInput {
  return {
    key: progression.key,
    tempoBpm: progression.bpm,
    grooveId: 'pop8',
    accompanimentPattern: pattern,
    accompanimentVariant: variantId,
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift: 0,
    releaseCut: false,
    instrumentEffect: 'sustain',
    drumMode: 'off',
    progression: progression.chords,
  };
}

function auditByVariant(): Record<string, Counts> {
  const byVariant: Record<string, Counts> = {};
  for (const pattern of PUBLIC_ACCOMPANIMENT_PATTERNS) {
    for (const variant of offeredVariantsFor(pattern)) {
      const counts: Counts = {};
      for (const progression of GOLDEN_PROGRESSIONS) {
        const report = buildSessionPerformancePlan(
          sessionFor(pattern, variant.id, progression),
          'free',
        ).collisionReport!;
        for (const [ruleId, count] of Object.entries(report.countsByRule)) {
          const key = ruleId as HarmonyCollisionRuleId;
          counts[key] = (counts[key] ?? 0) + count;
        }
      }
      byVariant[variant.id] = counts;
    }
  }
  return byVariant;
}

describe('harmony collision contract of the shipping accompaniment', () => {
  const actual = auditByVariant();

  it('never invents a tone, leaves the range, or crowds the bass', () => {
    for (const [variantId, counts] of Object.entries(actual)) {
      for (const ruleId of ZERO_TOLERANCE) {
        expect({ variantId, ruleId, count: counts[ruleId] ?? 0 }).toEqual({
          variantId,
          ruleId,
          count: 0,
        });
      }
    }
  });

  it('matches the recorded per-variant rule counts', () => {
    if (process.env.WRITE_HARMONY_COLLISION_DEBT === '1') {
      writeFileSync(
        join(__dirname, 'fixtures', 'harmonyCollisionContract.json'),
        `${JSON.stringify({ byVariant: actual }, null, 2)}\n`,
      );
    }
    expect(actual).toEqual(expected.byVariant);
  });

  it('meets the contract: no reject survives in any shipping variant', () => {
    for (const [variantId, counts] of Object.entries(actual)) {
      expect({ variantId, counts }).toEqual({ variantId, counts: {} });
    }
  });

  it('reports ok from the validator itself, not only from the counts', () => {
    // The counts could be empty while `ok` was false if a rule ever stopped
    // populating `countsByRule`. Read the validator's own verdict as well.
    for (const pattern of PUBLIC_ACCOMPANIMENT_PATTERNS) {
      for (const variant of offeredVariantsFor(pattern)) {
        for (const progression of GOLDEN_PROGRESSIONS) {
          const report = buildSessionPerformancePlan(
            sessionFor(pattern, variant.id, progression),
            'free',
          ).collisionReport!;
          expect({
            variantId: variant.id,
            progression: progression.id,
            ok: report.ok,
            rejects: report.rejects.length,
          }).toEqual({
            variantId: variant.id,
            progression: progression.id,
            ok: true,
            rejects: 0,
          });
        }
      }
    }
  });
});
