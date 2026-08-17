import {
  groupForSelection,
  PUBLIC_ACCOMPANIMENT_GROUPS,
  typeForSelection,
} from '@/features/editor/accompanimentGroups';
import { styleSummaryParts } from '@/features/editor/styleSummary';

describe('release accompaniment presentation groups', () => {
  it('shows City as one type inside Variation', () => {
    expect(PUBLIC_ACCOMPANIMENT_GROUPS.map((group) => group.id)).toEqual([
      'block',
      'natural',
      'variation',
    ]);

    const variation = PUBLIC_ACCOMPANIMENT_GROUPS[2]!;
    expect(variation.types.map((type) => type.label)).toEqual(['City']);
    expect(variation.types.map((type) => `${type.pattern}/${type.variant}`)).toEqual([
      'city/city.type1',
    ]);
  });

  it('maps a persisted City project to Variation without changing storage ids', () => {
    expect(groupForSelection('city', 'city.type1').id).toBe('variation');
    expect(typeForSelection('city', 'city.type1')).toMatchObject({
      pattern: 'city',
      variant: 'city.type1',
      label: 'City',
    });
  });

  it('summarizes City under the Variation parent label', () => {
    const common = {
      instrumentId: 'piano' as const,
      drumMode: 'off' as const,
      drumBeat: '8' as const,
    };
    expect(
      styleSummaryParts({
        ...common,
        accompanimentPattern: 'city',
        accompanimentVariant: 'city.type1',
      }).slice(0, 2),
    ).toEqual(['バリエーション', 'City']);
  });
});
