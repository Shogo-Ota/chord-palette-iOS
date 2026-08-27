/**
 * The collision debt of the shipping accompaniment, pinned per variant.
 *
 * The approved 87-point output does not pass the collision contract yet, and this
 * fixture is the honest record of by how much. It is a change detector in both
 * directions: a rise means a regression slipped in, a fall means a voicing policy
 * genuinely cleaned something up and the ledger should say so.
 *
 * Three rules are already clean and are asserted at zero rather than pinned, so they
 * become real gates today: no accompaniment may invent a tone the chord symbol never
 * named, leave the instrument range, or crowd the bass register.
 *
 * Regenerate with `WRITE_HARMONY_COLLISION_DEBT=1`, then run prettier on the fixture
 * and rerun without the flag (the write pass compares against the file it just
 * overwrote and is expected to fail).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import expected from '@/lib/performance/__tests__/fixtures/harmonyCollisionDebt.json';
import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { PerformanceSessionInput } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { HarmonyCollisionRuleId } from '@/lib/performance/harmonyCollision';
import { PUBLIC_ACCOMPANIMENT_PATTERNS } from '@/lib/performance/publicAccompaniment';
import { offeredVariantsFor } from '@/lib/performance/variants';

/** Rules that must never fire. A hit here is a bug, not debt. */
const ZERO_TOLERANCE: HarmonyCollisionRuleId[] = [
  'NON_CHORD_TONE',
  'INSTRUMENT_RANGE',
  'LOW_INTERVAL_LIMIT',
];

type Counts = Partial<Record<HarmonyCollisionRuleId, number>>;

function auditByVariant(): Record<string, Counts> {
  const byVariant: Record<string, Counts> = {};
  for (const pattern of PUBLIC_ACCOMPANIMENT_PATTERNS) {
    for (const variant of offeredVariantsFor(pattern)) {
      const counts: Counts = {};
      for (const progression of GOLDEN_PROGRESSIONS) {
        const session: PerformanceSessionInput = {
          key: progression.key,
          tempoBpm: progression.bpm,
          grooveId: 'pop8',
          accompanimentPattern: pattern,
          accompanimentVariant: variant.id,
          instrumentId: 'piano',
          accompanimentEnergy: 'build',
          octaveShift: 0,
          releaseCut: false,
          instrumentEffect: 'sustain',
          drumMode: 'off',
          progression: progression.chords,
        };
        const report = buildSessionPerformancePlan(session, 'free').collisionReport!;
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

describe('harmony collision debt of the shipping accompaniment', () => {
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

  it('matches the recorded debt per variant', () => {
    if (process.env.WRITE_HARMONY_COLLISION_DEBT === '1') {
      writeFileSync(
        join(__dirname, 'fixtures', 'harmonyCollisionDebt.json'),
        `${JSON.stringify({ byVariant: actual }, null, 2)}\n`,
      );
    }
    expect(actual).toEqual(expected.byVariant);
  });

  it('still fails the contract overall, so the gate cannot be declared met', () => {
    const totalRejects = Object.values(actual).reduce(
      (sum, counts) =>
        sum + (counts.MINOR_SECOND ?? 0) + (counts.MINOR_NINTH ?? 0) + (counts.MAJOR_SECOND ?? 0),
      0,
    );
    expect(totalRejects).toBeGreaterThan(0);
  });
});
