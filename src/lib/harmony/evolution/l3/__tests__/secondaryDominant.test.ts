import { MAJOR_KEYS } from '@/data/music';

import { chordCatalogEvolutionProvider } from '../../providers/chordCatalogEvolutionProvider';
import { triadChord, triadProgression } from '../../testing/phase1Progressions';
import { secondaryDominantProvider } from '../providers/secondaryDominantProvider';
import { l3Recipe } from '../recipes/l3Recipe';
import { l3EvolutionRuleRegistry } from '../ruleRegistry';
import { secondaryDominantRule } from '../rules/secondaryDominantRule';
import { l3Context } from '../testing/l3Progressions';

const dependencies = {
  theory: chordCatalogEvolutionProvider,
  secondaryDominant: secondaryDominantProvider,
};

describe('Secondary Dominant L3 evolution', () => {
  it.each(MAJOR_KEYS)('generates V/vi only when the %s major resolution target exists', (tonic) => {
    const context = l3Context(triadProgression(tonic, 'major', [0, 5]), {
      tonic,
    });
    const resolutions = secondaryDominantProvider.resolveSecondaryDominants(context, 1);
    expect(resolutions).toHaveLength(1);
    expect(resolutions[0]).toMatchObject({
      targetIndex: 1,
      targetDegree: 'vi',
      insertedSymbol: {
        rootOffset: 4,
        suffix: '7',
        definitionId: 'dom7',
      },
    });
  });

  it('builds a deterministic C(2) -> E7(2) -> Am candidate', () => {
    const context = l3Context(triadProgression('C', 'major', [0, 5]));
    const candidates = l3Recipe.build(context, l3EvolutionRuleRegistry, dependencies);
    expect(candidates).toHaveLength(1);
    expect(
      candidates[0]?.after.map((chord) => ({
        root: chord.symbol.rootOffset,
        suffix: chord.symbol.suffix,
        duration: chord.durationBeats,
      })),
    ).toEqual([
      { root: 0, suffix: '', duration: 2 },
      { root: 4, suffix: '7', duration: 2 },
      { root: 9, suffix: 'm', duration: 4 },
    ]);
    expect(candidates[0]).toMatchObject({
      level: 'reharm',
      technique: 'secondary_dominant',
      requiredTier: 'PRO',
      theoryLabel: 'SECONDARY_DOMINANT',
      rationaleCode: 'SECONDARY_DOMINANT_RESOLUTION',
      score: { status: 'UNEVALUATED' },
    });
    expect(l3Recipe.build(context, l3EvolutionRuleRegistry, dependencies)).toEqual(candidates);
  });

  it('requires a target, previous chord, progression scope and splittable duration', () => {
    const tonicTarget = l3Context(triadProgression('C', 'major', [4, 0]));
    expect(secondaryDominantRule.generate(tonicTarget, 1, dependencies)).toEqual([]);

    const oneBeatPrevious = l3Context([
      triadChord('C', 'major', 0, { durationBeats: 1 }),
      triadChord('C', 'major', 5),
    ]);
    expect(secondaryDominantProvider.resolveSecondaryDominants(oneBeatPrevious, 1)).toEqual([]);
    expect(secondaryDominantProvider.resolveSecondaryDominants(oneBeatPrevious, 0)).toEqual([]);
    expect(
      secondaryDominantProvider.resolveSecondaryDominants(
        l3Context(triadProgression('C', 'major', [0, 5]), {
          scope: { kind: 'chord', index: 1 },
        }),
        1,
      ),
    ).toEqual([]);
  });

  it('fails closed for natural minor and unsupported targets', () => {
    expect(
      l3Recipe.build(
        l3Context(triadProgression('A', 'minor', [0, 5]), {
          tonic: 'A',
          mode: 'minor',
        }),
        l3EvolutionRuleRegistry,
        dependencies,
      ),
    ).toEqual([]);
    expect(
      secondaryDominantProvider.resolveSecondaryDominants(
        l3Context(triadProgression('C', 'major', [0, 0])),
        1,
      ),
    ).toEqual([]);
  });

  it('preserves total beats and adds exactly one insertion change', () => {
    const context = l3Context(triadProgression('C', 'major', [0, 5]));
    const candidate = l3Recipe.build(context, l3EvolutionRuleRegistry, dependencies)[0];
    expect(candidate?.changes).toHaveLength(1);
    expect(candidate?.changes[0]?.kind).toBe('insert_before');
    expect(candidate?.after.reduce((sum, chord) => sum + chord.durationBeats, 0)).toBe(
      candidate?.before.reduce((sum, chord) => sum + chord.durationBeats, 0),
    );
  });

  it('splits a two-beat anchor into one plus one', () => {
    const context = l3Context([
      triadChord('C', 'major', 0, { durationBeats: 2 }),
      triadChord('C', 'major', 5),
    ]);
    const candidate = l3Recipe.build(context, l3EvolutionRuleRegistry, dependencies)[0];
    expect(candidate?.after.slice(0, 2).map((chord) => chord.durationBeats)).toEqual([1, 1]);
  });
});
