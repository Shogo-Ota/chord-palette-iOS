import {
  diatonicEvent,
  diatonicSeventhEvent,
} from '@/features/editor/chordEvolution/testing/fixtures';
import type { ChordEvent } from '@/types';

import { buildEvolutionUiModel } from '../uiModel';

function sessionWith(progression: ChordEvent[]) {
  return { key: 'C' as const, mode: 'major' as const, progression };
}

describe('Chord Evolution UI model', () => {
  it('always exposes Original, 7th and Rich labels', () => {
    const model = buildEvolutionUiModel(sessionWith([diatonicEvent('C', 'major', 0)]), {
      kind: 'progression',
    });
    expect(model.levels.map((level) => level.label)).toEqual(['Original', '7th', 'Rich']);
    expect(model.originalSummary).toBe('C');
  });

  it('shows L1 for a triad baseline and stages Rich until after L1 Apply', () => {
    const model = buildEvolutionUiModel(
      sessionWith([
        diatonicEvent('C', 'major', 0, { id: 'a' }),
        diatonicEvent('C', 'major', 4, { id: 'b' }),
      ]),
      { kind: 'progression' },
    );
    const seventh = model.levels.find((level) => level.level === 'seventh')!;
    const rich = model.levels.find((level) => level.level === 'tension')!;
    expect(seventh.candidates).toHaveLength(1);
    expect(seventh.candidates[0]?.summary).toBe('Cmaj7 · G7');
    expect(rich.candidates).toEqual([]);
    expect(rich.emptyMessage).toBe('先に7thを適用するとRich候補を探せます');
  });

  it('shows L2 candidates for a current bare-seventh baseline', () => {
    const model = buildEvolutionUiModel(
      sessionWith([
        diatonicSeventhEvent('C', 'major', 0, { id: 'a' }),
        diatonicSeventhEvent('C', 'major', 3, { id: 'b' }),
        diatonicSeventhEvent('C', 'major', 4, { id: 'c' }),
      ]),
      { kind: 'progression' },
    );
    const rich = model.levels.find((level) => level.level === 'tension')!;
    expect(rich.candidates.length).toBeGreaterThan(0);
    expect(rich.candidates.every((candidate) => candidate.candidate.level === 'tension')).toBe(
      true,
    );
  });

  it('builds a single-chord scope from the selected index only', () => {
    const model = buildEvolutionUiModel(
      sessionWith([
        diatonicEvent('C', 'major', 0, { id: 'a' }),
        diatonicEvent('C', 'major', 1, { id: 'b' }),
      ]),
      { kind: 'chord', index: 1 },
    );
    expect(model.scopeLabel).toBe('このコード');
    expect(model.originalSummary).toBe('Dm');
    const candidate = model.levels[1]?.candidates[0];
    expect(candidate?.summary).toBe('Dm → Dm7');
    expect(candidate?.candidate.scope).toEqual({
      kind: 'chord',
      index: 1,
    });
  });

  it('returns a safe empty state when neither L1 nor L2 is eligible', () => {
    const tension: ChordEvent = {
      ...diatonicSeventhEvent('C', 'major', 0),
      chordId: 'Cmaj9',
      displayName: 'Cmaj9',
      suffix: 'maj9',
      definitionId: 'maj9',
    };
    const model = buildEvolutionUiModel(sessionWith([tension]), {
      kind: 'progression',
    });
    expect(
      model.levels
        .filter((level) => level.level !== 'original')
        .every((level) => level.candidates.length === 0),
    ).toBe(true);
    expect(model.levels[2]?.emptyMessage).toBe('このレベルの候補はありません');
  });
});
