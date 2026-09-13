import { semanticHarmonyDiff } from '@/lib/comparison';
import { comparisonSource, snapshot } from '@/lib/comparison/testing/fixtures';
import {
  buildCompareSceneManifest,
  buildCompareTimePlan,
  evaluateCompareScene,
  frameIndexToSample,
  validateCompareScene,
} from '@/lib/videoExport/comparison';

function variantProgression() {
  return comparisonSource().progression.map((event, index) =>
    index === 2
      ? {
          ...event,
          chordId: '5:minor',
          displayName: 'Fm',
          suffix: 'm',
          definitionId: 'minor',
        }
      : { ...event },
  );
}

function manifest(motion: 'standard' | 'reduced' = 'standard') {
  const base = snapshot();
  const variant = snapshot({ progression: variantProgression() });
  const time = buildCompareTimePlan({
    base,
    variant,
    sampleRate: 48_000,
  });
  if (!time.ok) throw new Error(time.reason);
  return buildCompareSceneManifest({
    base,
    variant,
    timePlan: time.value,
    changes: semanticHarmonyDiff(base, variant),
    motion,
  });
}

describe('Compare scene manifest', () => {
  it('shares the exact sample timeline and truthful one-change copy', () => {
    const scene = manifest();
    expect(scene.timePlan.durationSamples).toBe(921_600);
    expect(scene.copy.hook).toBe('3つ目を変えると？');
    expect(scene.pages).toHaveLength(2);
    expect(scene.pages.every((page) => page.cards.length <= 4)).toBe(true);
    expect(scene.cues.find((cue) => cue.changeLabel)?.changeLabel).toBe('F → Fm');
    expect(validateCompareScene(scene)).toEqual({ ok: true });
  });

  it('changes ownership exactly at the A/B sample boundary', () => {
    const scene = manifest();
    expect(evaluateCompareScene(scene, 460_799)?.role).toBe('base');
    expect(evaluateCompareScene(scene, 460_800)).toMatchObject({
      role: 'variant',
      cue: { sourceIndex: 0, currentChord: 'C' },
    });
    expect(frameIndexToSample(scene, 288)).toBe(460_800);
  });

  it('anticipates for at most 300 ms and reveals on the changed boundary', () => {
    const scene = manifest();
    const changed = scene.cues.find((cue) => cue.role === 'variant' && cue.changed)!;
    expect(changed.startSample - changed.anticipationStartSample).toBe(14_400);
    expect(evaluateCompareScene(scene, changed.anticipationStartSample - 1)?.anticipating).toBe(
      false,
    );
    expect(evaluateCompareScene(scene, changed.anticipationStartSample)?.anticipating).toBe(true);
    expect(evaluateCompareScene(scene, changed.startSample)).toMatchObject({
      anticipating: false,
      cue: { currentChord: 'Fm', changed: true },
      revealProgress: 0,
    });
  });

  it('uses fixed semantic state for reduced motion', () => {
    const scene = manifest('reduced');
    const changed = scene.cues.find((cue) => cue.role === 'variant' && cue.changed)!;
    expect(evaluateCompareScene(scene, changed.startSample)?.revealProgress).toBe(0);
    expect(evaluateCompareScene(scene, changed.startSample + 1)?.revealProgress).toBe(1);
  });

  it('paginates eight chords without shrinking more than four onto one page', () => {
    const source = comparisonSource();
    const progression = [
      ...source.progression,
      ...source.progression.map((event, index) => ({
        ...event,
        id: `second-${index}`,
      })),
    ];
    const base = snapshot({ progression });
    const variantProgression = progression.map((event, index) =>
      index === 6
        ? {
            ...event,
            chordId: '5:minor',
            displayName: 'Fm',
            suffix: 'm',
            definitionId: 'minor',
          }
        : event,
    );
    const variant = snapshot({ progression: variantProgression });
    const time = buildCompareTimePlan({
      base,
      variant,
      sampleRate: 48_000,
    });
    if (!time.ok) throw new Error(time.reason);
    const scene = buildCompareSceneManifest({
      base,
      variant,
      timePlan: time.value,
      changes: semanticHarmonyDiff(base, variant),
      motion: 'standard',
    });

    expect(scene.pages).toHaveLength(4);
    expect(scene.pages.map((page) => page.cards.length)).toEqual([4, 4, 4, 4]);
    expect(scene.cues.find((cue) => cue.sourceIndex === 6)?.pageIndex).toBe(1);
  });
});
