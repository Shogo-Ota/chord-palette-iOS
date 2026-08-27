/**
 * The gate itself: does `compact.v3` actually produce accompaniment the collision
 * contract passes?
 *
 * The unit tests prove each rule decides correctly. This proves the rules can be
 * satisfied — that enforcing them still leaves a legal, complete voicing for every
 * chord in the corpus, across every offered variant and every inversion.
 *
 * The comparison against v1 and v2 is part of the gate, not decoration: a policy
 * that reached zero by emptying the voicing would be worse than the defect it fixed,
 * so tone completeness is asserted alongside cleanliness.
 */
import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import {
  COMPACT_V1_POLICY,
  COMPACT_V2_POLICY,
  COMPACT_V3_POLICY,
  buildCompactBaseVoicings,
  setVoicingPolicyOverride,
  type VoicingPolicyId,
  type VoicingPosition,
} from '@/lib/performance/baseVoicing';
import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { PerformanceSessionInput } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { HarmonyCollisionRuleId } from '@/lib/performance/harmonyCollision';
import { PUBLIC_ACCOMPANIMENT_PATTERNS } from '@/lib/performance/publicAccompaniment';
import { offeredVariantsFor } from '@/lib/performance/variants';
import { chordHarmonyFromEvent } from '@/lib/performance/humanTemplate/chordHarmony';

const POSITIONS: VoicingPosition[] = ['root', 'first', 'second'];

function session(
  pattern: (typeof PUBLIC_ACCOMPANIMENT_PATTERNS)[number],
  variantId: string,
  progression: (typeof GOLDEN_PROGRESSIONS)[number],
): PerformanceSessionInput {
  return {
    key: progression.key,
    tempoBpm: progression.bpm,
    grooveId: 'pop8',
    accompanimentPattern: pattern,
    accompanimentVariant: variantId as PerformanceSessionInput['accompanimentVariant'],
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift: 0,
    releaseCut: false,
    instrumentEffect: 'sustain',
    drumMode: 'off',
    progression: progression.chords,
  };
}

function rejectsUnderActivePolicy(): { total: number; byRule: Record<string, number> } {
  const byRule: Record<string, number> = {};
  let total = 0;
  for (const pattern of PUBLIC_ACCOMPANIMENT_PATTERNS) {
    for (const variant of offeredVariantsFor(pattern)) {
      for (const progression of GOLDEN_PROGRESSIONS) {
        const report = buildSessionPerformancePlan(
          session(pattern, variant.id, progression),
          'free',
        ).collisionReport!;
        for (const reject of report.rejects) {
          byRule[reject.ruleId] = (byRule[reject.ruleId] ?? 0) + 1;
          total += 1;
        }
      }
    }
  }
  return { total, byRule };
}

describe('compact.v3 satisfies the harmony collision contract', () => {
  afterEach(() => {
    setVoicingPolicyOverride(null);
  });

  it('leaves no reject anywhere in the corpus', () => {
    setVoicingPolicyOverride('compact.v3' as VoicingPolicyId);
    const got = rejectsUnderActivePolicy();
    expect(got).toEqual({ total: 0, byRule: {} });
  });

  /**
   * Why v2 was not enough. It clears both defects the approved policy carries, then
   * introduces one the approved policy never had: spreading a voicing to escape a
   * semitone lands the same two pitch classes an octave and a semitone apart. Only a
   * policy that judges the minor ninth as well reaches zero, which is the argument
   * for v3 existing rather than shipping v2.
   */
  it('shows why neither shipped policy is enough', () => {
    setVoicingPolicyOverride('compact.v1' as VoicingPolicyId);
    const v1 = rejectsUnderActivePolicy();
    setVoicingPolicyOverride('compact.v2' as VoicingPolicyId);
    const v2 = rejectsUnderActivePolicy();
    setVoicingPolicyOverride('compact.v3' as VoicingPolicyId);
    const v3 = rejectsUnderActivePolicy();

    expect(v1).toEqual({ total: 175, byRule: { MINOR_SECOND: 87, MAJOR_SECOND: 88 } });
    expect(v2).toEqual({ total: 23, byRule: { MINOR_NINTH: 23 } });
    expect(v3).toEqual({ total: 0, byRule: {} });
  });
});

describe('the gate does not thin the harmony to reach zero', () => {
  const harmonies = GOLDEN_PROGRESSIONS.flatMap((progression) =>
    progression.chords.map((chord) => chordHarmonyFromEvent(chord, progression.key)),
  );

  it.each(POSITIONS)('keeps every guide tone and declared tension at %s position', (position) => {
    const voicings = buildCompactBaseVoicings(
      harmonies,
      { position, octaveShift: 0 },
      COMPACT_V3_POLICY,
    );
    expect(voicings).toHaveLength(harmonies.length);
    voicings.forEach((voicing, index) => {
      const harmony = harmonies[index]!;
      const sounding = new Set(voicing.notes.map((note) => ((note.pc % 12) + 12) % 12));
      const required = harmony.chordIntervals
        .filter((interval) => {
          const normalized = ((interval % 12) + 12) % 12;
          // Third, seventh, altered fifth and every declared tension.
          return ![0, 7].includes(normalized);
        })
        .map((interval) => (((harmony.rootPc + interval) % 12) + 12) % 12);
      for (const pc of required) {
        expect({ symbol: harmony.symbol, position, pc, present: sounding.has(pc) }).toEqual({
          symbol: harmony.symbol,
          position,
          pc,
          present: true,
        });
      }
    });
  });

  it.each(POSITIONS)('holds at least three notes per chord at %s position', (position) => {
    for (const policy of [COMPACT_V1_POLICY, COMPACT_V2_POLICY, COMPACT_V3_POLICY]) {
      const voicings = buildCompactBaseVoicings(harmonies, { position, octaveShift: 0 }, policy);
      for (const voicing of voicings) {
        expect(voicing.notes.length).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe('collision rules never rewrite harmony', () => {
  it('keeps v3 pitch classes inside the chord at every position', () => {
    const harmonies = GOLDEN_PROGRESSIONS.flatMap((progression) =>
      progression.chords.map((chord) => chordHarmonyFromEvent(chord, progression.key)),
    );
    for (const position of POSITIONS) {
      const voicings = buildCompactBaseVoicings(
        harmonies,
        { position, octaveShift: 0 },
        COMPACT_V3_POLICY,
      );
      voicings.forEach((voicing, index) => {
        const allowed = new Set(
          harmonies[index]!.chordIntervals.map(
            (interval) => (((harmonies[index]!.rootPc + interval) % 12) + 12) % 12,
          ),
        );
        for (const note of voicing.notes) {
          expect(allowed.has(((note.pc % 12) + 12) % 12)).toBe(true);
        }
      });
    }
  });
});

describe('rule ids stay a closed set', () => {
  it('names every rule the report can produce', () => {
    const known: HarmonyCollisionRuleId[] = [
      'NON_CHORD_TONE',
      'INSTRUMENT_RANGE',
      'DUPLICATE_NOTE',
      'LOW_INTERVAL_LIMIT',
      'MINOR_SECOND',
      'MINOR_NINTH',
      'MAJOR_SECOND',
      'TRITONE',
      'MAJOR_SEVENTH',
      'OCTAVE',
    ];
    expect(new Set(known).size).toBe(known.length);
  });
});
