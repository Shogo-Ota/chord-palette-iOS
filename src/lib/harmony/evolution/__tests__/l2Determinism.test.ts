import { generateEvolutionCandidates } from '../generateCandidates';
import { availableTensionRule } from '../rules/availableTensionRule';
import { chordCatalogTensionProvider } from '../providers/chordCatalogTensionProvider';
import { l2Context, seventhProgression } from '../testing/l2Progressions';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

describe('L2 determinism and immutability', () => {
  it('returns byte-for-byte equivalent candidates for 100 runs', () => {
    const context = l2Context(seventhProgression('C', 'major', [0, 3, 4, 5]));
    const expected = JSON.stringify(generateEvolutionCandidates(context));
    for (let run = 0; run < 100; run += 1) {
      expect(JSON.stringify(generateEvolutionCandidates(context))).toBe(expected);
    }
  });

  it('does not mutate a deeply frozen context or source progression', () => {
    const progression = seventhProgression('A', 'minor', [0, 3, 4, 6]);
    const snapshot = JSON.stringify(progression);
    const context = deepFreeze(l2Context(progression, { tonic: 'A', mode: 'minor' }));
    const contextSnapshot = JSON.stringify(context);

    expect(() => generateEvolutionCandidates(context)).not.toThrow();
    expect(JSON.stringify(context)).toBe(contextSnapshot);
    expect(JSON.stringify(progression)).toBe(snapshot);
  });

  it('returns independent before/after objects from a rule application', () => {
    const context = l2Context(seventhProgression('C', 'major', [0]));
    const application = availableTensionRule.generate(context, 0, {
      theory: {} as never,
      tension: chordCatalogTensionProvider,
    })[0];
    expect(application?.change.kind).toBe('replace');
    if (!application || application.change.kind !== 'replace') return;
    expect(application.change.before).not.toBe(context.progression[0]);
    expect(application.change.after).not.toBe(context.progression[0]);
    expect(application.change.before.symbol).not.toBe(context.progression[0]!.symbol);
    expect(application.change.after.symbol).not.toBe(context.progression[0]!.symbol);
  });
});
