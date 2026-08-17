import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
} from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { PUBLIC_ACCOMPANIMENT_PATTERNS } from '@/lib/performance/publicAccompaniment';
import { defaultVariantFor } from '@/lib/performance/variants';
import type { Tier } from '@/lib/performance/tier';
import { VOICING_POSITIONS, type VoicingPosition } from '@/lib/performance/baseVoicing';
import { DEFAULT_OCTAVE_SHIFT } from '@/repositories/sessionPrefsRepository';
import type { AccompanimentPattern } from '@/types';

function pc(pitch: number): number {
  return ((pitch % 12) + 12) % 12;
}

function plan(
  progression: (typeof GOLDEN_PROGRESSIONS)[number],
  pattern: AccompanimentPattern,
  tier: Tier,
  position: VoicingPosition = 'root',
  octaveShift = 0,
) {
  const session: PerformanceSessionInput = {
    key: progression.key,
    tempoBpm: progression.bpm,
    grooveId: 'pop8',
    accompanimentPattern: pattern,
    accompanimentVariant: defaultVariantFor(pattern).id,
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift,
    voicingPosition: position,
    releaseCut: false,
    instrumentEffect: 'off',
    drumMode: 'off',
    progression: progression.chords,
  };
  return buildSessionPerformancePlan(session, tier);
}

function baseSignature(source: ReturnType<typeof plan>): string {
  return source.chords
    .map((chord) => `${chord.bassMidi.join(',')}/${chord.bodyMidi.join(',')}`)
    .join('|');
}

describe('Shared Base Voicing — Production reachability', () => {
  it('is exactly invariant across public style and tier', () => {
    for (const progression of GOLDEN_PROGRESSIONS) {
      const signatures = PUBLIC_ACCOMPANIMENT_PATTERNS.flatMap((pattern) =>
        (['free', 'pro'] as const).map((tier) => baseSignature(plan(progression, pattern, tier))),
      );
      expect(new Set(signatures)).toEqual(new Set([signatures[0]]));
    }
  });

  it.each(VOICING_POSITIONS)(
    '%s selects the requested bass degree and remains style invariant',
    (position) => {
      for (const progression of GOLDEN_PROGRESSIONS) {
        const rendered = PUBLIC_ACCOMPANIMENT_PATTERNS.map((pattern) =>
          plan(progression, pattern, 'free', position),
        );
        expect(new Set(rendered.map(baseSignature)).size).toBe(1);

        rendered[0]!.chords.forEach((chord) => {
          const harmony = chord.harmony!;
          const uniquePcs = [
            ...new Set(harmony.chordIntervals.map((interval) => pc(harmony.rootPc + interval))),
          ];
          const index = position === 'root' ? 0 : position === 'first' ? 1 : 2;
          const expected =
            harmony.slashBassPc == null
              ? uniquePcs[Math.min(index, uniquePcs.length - 1)]!
              : pc(harmony.slashBassPc);
          expect(pc(chord.bassMidi[0]!)).toBe(expected);
        });
      }
    },
  );

  it('applies octaveShift to the same Base Voicing before every style', () => {
    const progression = GOLDEN_PROGRESSIONS.find((candidate) => candidate.id === 'H')!;
    for (const pattern of PUBLIC_ACCOMPANIMENT_PATTERNS) {
      const low = plan(progression, pattern, 'free', 'root', 0);
      const high = plan(progression, pattern, 'free', 'root', 1);
      expect(high.chords.map((chord) => [...chord.bassMidi, ...chord.bodyMidi])).toEqual(
        low.chords.map((chord) =>
          [...chord.bassMidi, ...chord.bodyMidi].map((pitch) => pitch + 12),
        ),
      );
    }
  });

  it('keeps the product default in the neutral compact register for every style', () => {
    const progression = GOLDEN_PROGRESSIONS.find((candidate) => candidate.id === 'H')!;
    expect(DEFAULT_OCTAVE_SHIFT).toBe(0);

    for (const pattern of PUBLIC_ACCOMPANIMENT_PATTERNS) {
      const rendered = plan(progression, pattern, 'free', 'root', DEFAULT_OCTAVE_SHIFT);
      rendered.chords.forEach((chord) => {
        expect(chord.bassMidi[0]).toBeGreaterThanOrEqual(36);
        expect(chord.bassMidi[0]).toBeLessThanOrEqual(48);
        expect(Math.min(...chord.bodyMidi)).toBeGreaterThanOrEqual(48);
        expect(Math.max(...chord.bodyMidi)).toBeLessThanOrEqual(72);
      });
    }
  });
});
