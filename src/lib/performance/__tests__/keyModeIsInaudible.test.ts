/**
 * Minor mode must not reach the accompaniment engine.
 *
 * The claim behind shipping minor without re-auditioning `compact.v3` is that mode is a
 * naming and library concern only: pitches come from the tonic pitch class plus each
 * chord's `rootOffset`, so the same chords sound identical whichever mode they were
 * entered under. This asserts that claim end to end, on the real plan builder, for every
 * shipping variant — if a future change lets mode influence harmony, voicing or timing,
 * this fails rather than quietly altering approved output.
 */
import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { PerformanceSessionInput } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { PUBLIC_ACCOMPANIMENT_PATTERNS } from '@/lib/performance/publicAccompaniment';
import { offeredVariantsFor } from '@/lib/performance/variants';
import { rootDegreeLabel } from '@/data/music';
import type { ChordEvent, KeyMode } from '@/types';

/**
 * The same chords as a minor-mode session would hold them: relabelled degrees, the mode
 * stamped per chord. Root offsets and suffixes — the only things the engine reads — are
 * untouched, which is exactly what is under test.
 */
function asMode(progression: readonly ChordEvent[], mode: KeyMode): ChordEvent[] {
  return progression.map((event) => ({
    ...event,
    modeContext: mode,
    degreeLabel: rootDegreeLabel(event.rootOffset ?? 0, mode),
  }));
}

function session(
  pattern: (typeof PUBLIC_ACCOMPANIMENT_PATTERNS)[number],
  variantId: string,
  progression: (typeof GOLDEN_PROGRESSIONS)[number],
  mode: KeyMode,
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
    progression: asMode(progression.chords, mode),
  };
}

describe('key mode is inaudible', () => {
  it('produces identical MIDI whichever mode the chords were entered under', () => {
    const differing: string[] = [];
    for (const pattern of PUBLIC_ACCOMPANIMENT_PATTERNS) {
      for (const variant of offeredVariantsFor(pattern)) {
        for (const progression of GOLDEN_PROGRESSIONS) {
          const major = buildSessionPerformancePlan(
            session(pattern, variant.id, progression, 'major'),
            'free',
          );
          const minor = buildSessionPerformancePlan(
            session(pattern, variant.id, progression, 'minor'),
            'free',
          );
          if (JSON.stringify(minor.notes) !== JSON.stringify(major.notes)) {
            differing.push(`${pattern}/${variant.id}/${progression.id}`);
          }
        }
      }
    }
    expect(differing).toEqual([]);
  });

  it('relabels the degrees it was given, so the fixture is a real difference', () => {
    const progression = GOLDEN_PROGRESSIONS[0]!;
    const major = asMode(progression.chords, 'major').map((e) => e.degreeLabel);
    const minor = asMode(progression.chords, 'minor').map((e) => e.degreeLabel);

    expect(minor).not.toEqual(major);
  });

  it('leaves the collision contract clean in minor too', () => {
    for (const progression of GOLDEN_PROGRESSIONS) {
      const plan = buildSessionPerformancePlan(
        session('natural', 'natural.type1', progression, 'minor'),
        'free',
      );
      expect({ id: progression.id, rejects: plan.collisionReport!.rejects.length }).toEqual({
        id: progression.id,
        rejects: 0,
      });
    }
  });
});
