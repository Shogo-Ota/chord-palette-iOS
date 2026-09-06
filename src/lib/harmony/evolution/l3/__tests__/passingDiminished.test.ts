import { chordCatalogEvolutionProvider } from '../../providers/chordCatalogEvolutionProvider';
import { triadChord, triadProgression } from '../../testing/phase1Progressions';
import { passingDiminishedProvider } from '../providers/passingDiminishedProvider';
import { l3Recipe } from '../recipes/l3Recipe';
import { l3EvolutionRuleRegistry } from '../ruleRegistry';
import { l3Context } from '../testing/l3Progressions';

const dependencies = {
  theory: chordCatalogEvolutionProvider,
  passingDiminished: passingDiminishedProvider,
};

describe('Passing Diminished L3 evolution', () => {
  it.each([
    { degrees: [0, 1], insertedRoot: 1, direction: 1 },
    { degrees: [2, 1], insertedRoot: 3, direction: -1 },
    { degrees: [3, 4], insertedRoot: 6, direction: 1 },
    { degrees: [4, 5], insertedRoot: 8, direction: 1 },
  ] as const)(
    'accepts only curated chromatic motion for $degrees',
    ({ degrees, insertedRoot, direction }) => {
      const context = l3Context(triadProgression('C', 'major', degrees));
      expect(passingDiminishedProvider.resolvePassingDiminished(context, 1)).toEqual([
        expect.objectContaining({
          targetIndex: 1,
          direction,
          bassMotion: [1, 1],
          insertedSymbol: expect.objectContaining({
            rootOffset: insertedRoot,
            suffix: 'dim7',
            definitionId: 'dim7',
          }),
        }),
      ]);
    },
  );

  it('builds C(2) -> C#dim7(2) -> Dm without changing total beats', () => {
    const context = l3Context(triadProgression('C', 'major', [0, 1]));
    const candidate = l3Recipe
      .build(context, l3EvolutionRuleRegistry, dependencies)
      .find((item) => item.technique === 'passing_diminished');
    expect(
      candidate?.after.map((chord) => ({
        root: chord.symbol.rootOffset,
        suffix: chord.symbol.suffix,
        duration: chord.durationBeats,
      })),
    ).toEqual([
      { root: 0, suffix: '', duration: 2 },
      { root: 1, suffix: 'dim7', duration: 2 },
      { root: 2, suffix: 'm', duration: 4 },
    ]);
    expect(candidate).toMatchObject({
      requiredTier: 'PRO',
      theoryLabel: 'PASSING_DIMINISHED',
      rationaleCode: 'CHROMATIC_PASSING_DIMINISHED',
      changes: [{ kind: 'insert_before', index: 1 }],
    });
    expect(candidate?.after.reduce((sum, chord) => sum + chord.durationBeats, 0)).toBe(8);
  });

  it('rejects non-chromatic approaches, one-beat anchors and slash endpoints', () => {
    expect(
      passingDiminishedProvider.resolvePassingDiminished(
        l3Context(triadProgression('C', 'major', [3, 1])),
        1,
      ),
    ).toEqual([]);
    expect(
      passingDiminishedProvider.resolvePassingDiminished(
        l3Context([triadChord('C', 'major', 0, { durationBeats: 1 }), triadChord('C', 'major', 1)]),
        1,
      ),
    ).toEqual([]);
    const slashPrevious = {
      ...triadChord('C', 'major', 0),
      symbol: {
        ...triadChord('C', 'major', 0).symbol,
        bassOffset: 4,
      },
    };
    expect(
      passingDiminishedProvider.resolvePassingDiminished(
        l3Context([slashPrevious, triadChord('C', 'major', 1)]),
        1,
      ),
    ).toEqual([]);
  });

  it('fails closed outside major progression scope', () => {
    const progression = triadProgression('A', 'minor', [0, 1]);
    expect(
      passingDiminishedProvider.resolvePassingDiminished(
        l3Context(progression, { tonic: 'A', mode: 'minor' }),
        1,
      ),
    ).toEqual([]);
    expect(
      passingDiminishedProvider.resolvePassingDiminished(
        l3Context(triadProgression('C', 'major', [0, 1]), {
          scope: { kind: 'chord', index: 1 },
        }),
        1,
      ),
    ).toEqual([]);
  });
});
