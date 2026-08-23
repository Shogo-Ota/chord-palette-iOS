/**
 * Exact audible-output checkpoint for the user-approved 87/100 baseline.
 *
 * Updating these digests requires all hard gates, a new real-device listening
 * score of at least 87, and a matching Quality Ledger update. New Types get new
 * keys; they must not rewrite existing keys.
 */
import { createHash } from 'node:crypto';

import expected from '@/lib/performance/__tests__/fixtures/accompanimentReleaseBaselineV87.json';
import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
} from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { PUBLIC_ACCOMPANIMENT_PATTERNS } from '@/lib/performance/publicAccompaniment';
import { offeredVariantsFor } from '@/lib/performance/variants';

const PROTECTED_VARIANTS = new Set(['block.type1', 'natural.type1', 'city.type1']);

function quantize(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function releaseDigests(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pattern of PUBLIC_ACCOMPANIMENT_PATTERNS) {
    for (const variant of offeredVariantsFor(pattern)) {
      if (!PROTECTED_VARIANTS.has(variant.id)) continue;
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
        const plan = buildSessionPerformancePlan(session, 'free');
        const snapshot = buildFinalMidiSnapshot(plan);
        const payload = {
          base: plan.chords.map((chord) => ({
            bass: chord.bassMidi,
            body: chord.bodyMidi,
          })),
          notes: snapshot.notes
            .filter((note) => note.track === 'accompaniment')
            .map((note) => [
              quantize(note.startBeat),
              quantize(note.durationBeat),
              note.pitch,
              note.velocity,
            ]),
          cc64: snapshot.controlChanges
            .filter((event) => event.controller === 64)
            .map((event) => [quantize(event.startBeat), event.value]),
        };
        const key = `${progression.id}:${pattern}:${variant.id}`;
        result[key] = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      }
    }
  }
  return result;
}

describe('87-point accompaniment release baseline', () => {
  it('keeps approved Block, Natural Type1 and City byte-stable', () => {
    const actual = releaseDigests();
    const protectedExpected = Object.fromEntries(
      Object.entries(expected.digests).filter(([key]) =>
        [...PROTECTED_VARIANTS].some((variantId) => key.endsWith(`:${variantId}`)),
      ),
    );
    if (process.env.PRINT_RELEASE_BASELINE === '1') {
      // Explicit maintenance command; normal tests still compare the tracked fixture.
      console.log(JSON.stringify(actual, null, 2));
    }
    expect(actual).toEqual(protectedExpected);
  });
});
