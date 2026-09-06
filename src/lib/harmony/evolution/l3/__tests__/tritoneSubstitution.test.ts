import { chordCatalogEvolutionProvider } from '../../providers/chordCatalogEvolutionProvider';
import { seventhProgression } from '../../testing/l2Progressions';
import { triadChord, triadProgression } from '../../testing/phase1Progressions';
import type { EvolutionChord } from '../../types';
import { tritoneSubstitutionProvider } from '../providers/tritoneSubstitutionProvider';
import { l3Recipe } from '../recipes/l3Recipe';
import { l3EvolutionRuleRegistry } from '../ruleRegistry';
import { l3Context } from '../testing/l3Progressions';

const dependencies = {
  theory: chordCatalogEvolutionProvider,
  tritoneSubstitution: tritoneSubstitutionProvider,
};

function dominantSeven(rootOffset: number, eventId: string): EvolutionChord {
  return {
    eventId,
    chordId: `dominant-${rootOffset}`,
    symbol: {
      rootOffset,
      suffix: '7',
      definitionId: 'dom7',
    },
    function: 'dominant',
    durationBeats: 4,
    voicingPosition: 'root',
  };
}

describe('Tritone Substitute L3 evolution', () => {
  it('replaces G7 -> Cmaj7 with Db7 -> Cmaj7', () => {
    const context = l3Context(seventhProgression('C', 'major', [4, 0]));
    const candidate = l3Recipe
      .build(context, l3EvolutionRuleRegistry, dependencies)
      .find((item) => item.technique === 'tritone_substitute');
    expect(candidate).toMatchObject({
      technique: 'tritone_substitute',
      theoryLabel: 'TRITONE_SUBSTITUTE',
      rationaleCode: 'TRITONE_DOMINANT_SUBSTITUTION',
      changes: [{ kind: 'replace', index: 0 }],
    });
    expect(candidate?.after[0]?.symbol).toMatchObject({
      rootOffset: 1,
      rootSpelling: { degreeIndex: 1, alteration: -1 },
      suffix: '7',
      definitionId: 'dom7',
    });
    expect(candidate?.after[1]).toEqual(candidate?.before[1]);
  });

  it('supports an explicitly present E7 -> Am secondary resolution pair', () => {
    const context = l3Context([
      dominantSeven(4, 'e7'),
      triadChord('C', 'major', 5, { eventId: 'am' }),
    ]);
    expect(tritoneSubstitutionProvider.resolveTritoneSubstitutions(context, 0)).toEqual([
      expect.objectContaining({
        dominantIndex: 0,
        targetIndex: 1,
        targetSymbol: expect.objectContaining({
          rootOffset: 10,
          suffix: '7',
        }),
      }),
    ]);
  });

  it('preserves the dominant guide-tone pitch classes', () => {
    const context = l3Context(seventhProgression('C', 'major', [4, 0]));
    const substitute = tritoneSubstitutionProvider.resolveTritoneSubstitutions(context, 0)[0];
    const guideTones = (root: number) =>
      [root + 4, root + 10].map((pitch) => pitch % 12).sort((a, b) => a - b);
    expect(guideTones(substitute!.targetSymbol.rootOffset)).toEqual(
      guideTones(context.progression[0]!.symbol.rootOffset),
    );
  });

  it('rejects unresolved, non-dominant and terminal dominant chords', () => {
    expect(
      tritoneSubstitutionProvider.resolveTritoneSubstitutions(
        l3Context([dominantSeven(7, 'g7'), triadChord('C', 'major', 5)]),
        0,
      ),
    ).toEqual([]);
    expect(
      tritoneSubstitutionProvider.resolveTritoneSubstitutions(
        l3Context(triadProgression('C', 'major', [4, 0])),
        0,
      ),
    ).toEqual([]);
    expect(
      tritoneSubstitutionProvider.resolveTritoneSubstitutions(
        l3Context([dominantSeven(7, 'g7')]),
        0,
      ),
    ).toEqual([]);
  });

  it('fails closed for natural minor and chord scope', () => {
    const minor = l3Context(
      [dominantSeven(4, 'e7'), triadChord('A', 'minor', 0, { eventId: 'am' })],
      { tonic: 'A', mode: 'minor' },
    );
    expect(tritoneSubstitutionProvider.resolveTritoneSubstitutions(minor, 0)).toEqual([]);
    expect(
      tritoneSubstitutionProvider.resolveTritoneSubstitutions(
        l3Context(seventhProgression('C', 'major', [4, 0]), {
          scope: { kind: 'chord', index: 0 },
        }),
        0,
      ),
    ).toEqual([]);
  });
});
