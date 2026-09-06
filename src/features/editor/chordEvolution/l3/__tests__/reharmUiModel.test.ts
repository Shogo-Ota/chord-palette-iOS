import {
  diatonicEvent,
  diatonicSeventhEvent,
} from '@/features/editor/chordEvolution/testing/fixtures';

import { buildEvolutionUiModelWithReharm } from '../reharmUiModel';

function sessionWith(
  progression: ReturnType<typeof diatonicEvent>[],
  mode: 'major' | 'minor' = 'major',
) {
  return { key: 'C' as const, mode, progression };
}

describe('L3 Reharm UI model', () => {
  it('adds Reharm only to progression scope and exposes short Japanese rationale', () => {
    const session = sessionWith([
      diatonicEvent('C', 'major', 0, { id: 'c' }),
      diatonicEvent('C', 'major', 5, { id: 'am' }),
      diatonicEvent('C', 'major', 3, { id: 'f' }),
      diatonicEvent('C', 'major', 4, { id: 'g' }),
    ]);
    const model = buildEvolutionUiModelWithReharm(session, {
      kind: 'progression',
    });
    expect(model.levels.map((level) => level.label)).toEqual(['Original', '7th', 'Rich', 'Reharm']);
    const reharm = model.levels.find((level) => level.level === 'reharm');
    expect(reharm?.candidates.length).toBeGreaterThan(0);
    expect(reharm?.candidates.length).toBeLessThanOrEqual(3);
    expect(
      reharm?.candidates.every(
        (candidate) => candidate.candidate.requiredTier === 'PRO' && candidate.rationale.length > 0,
      ),
    ).toBe(true);

    expect(
      buildEvolutionUiModelWithReharm(session, {
        kind: 'chord',
        index: 1,
      }).levels.map((level) => level.label),
    ).toEqual(['Original', '7th', 'Rich']);
  });

  it('shows the explicit natural-minor fail-closed message', () => {
    const session = {
      key: 'A' as const,
      mode: 'minor' as const,
      progression: [diatonicEvent('A', 'minor', 0), diatonicEvent('A', 'minor', 5)],
    };
    const reharm = buildEvolutionUiModelWithReharm(session, {
      kind: 'progression',
    }).levels.find((level) => level.level === 'reharm');
    expect(reharm?.candidates).toEqual([]);
    expect(reharm?.emptyMessage).toBe('Reharmは現在メジャーキーで利用できます');
  });

  it('can present ranked frozen-L2 and L3 techniques in the same Reharm section', () => {
    const session = sessionWith([
      diatonicSeventhEvent('C', 'major', 0, { id: 'c' }),
      diatonicSeventhEvent('C', 'major', 3, { id: 'f' }),
      diatonicSeventhEvent('C', 'major', 4, { id: 'g' }),
      diatonicSeventhEvent('C', 'major', 0, { id: 'c2' }),
    ]);
    const reharm = buildEvolutionUiModelWithReharm(session, {
      kind: 'progression',
    }).levels.find((level) => level.level === 'reharm');
    expect(
      reharm?.candidates.some((candidate) =>
        ['add_tension', 'slash_chord'].includes(candidate.candidate.technique),
      ),
    ).toBe(true);
    expect(
      reharm?.candidates.some((candidate) =>
        ['secondary_dominant', 'passing_diminished', 'tritone_substitute'].includes(
          candidate.candidate.technique,
        ),
      ),
    ).toBe(true);
  });
});
