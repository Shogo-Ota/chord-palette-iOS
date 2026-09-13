import {
  groupForSelection,
  PUBLIC_ACCOMPANIMENT_GROUPS,
  typeForSelection,
} from '@/features/editor/accompanimentGroups';
import { styleSummaryParts } from '@/features/editor/styleSummary';
import { midiExportStyleToken } from '@/lib/midiExport';
import { PUBLIC_STYLE_GROUPS } from '@/lib/performance/publicStyleCatalog';

describe('release accompaniment presentation groups', () => {
  it('shows exactly the STYLEs the export names, from one catalog', () => {
    expect(
      PUBLIC_ACCOMPANIMENT_GROUPS.map((group) => ({
        id: group.id,
        label: group.label,
        types: group.types,
      })),
    ).toEqual(
      PUBLIC_STYLE_GROUPS.map((group) => ({
        id: group.id,
        label: group.label,
        types: group.styles.map((style) => ({
          pattern: style.pattern,
          variant: style.variant,
          label: style.typeLabel,
          hint: style.hint,
        })),
      })),
    );

    const named = PUBLIC_ACCOMPANIMENT_GROUPS.flatMap((group) =>
      group.types.map((type) => midiExportStyleToken(type.pattern, type.variant)),
    );
    expect(named).toEqual([
      'Block',
      'Natural-Type1',
      'Natural-Type2',
      'Variation-City',
      'Variation-Funk',
      'Variation-Driving',
      'Variation-Dance',
      'Arpeggio',
    ]);
  });

  it('regroups the approved profiles without changing playback ids', () => {
    expect(PUBLIC_ACCOMPANIMENT_GROUPS.map((group) => group.id)).toEqual([
      'block',
      'natural',
      'variation',
      'arpeggio',
    ]);
    expect(PUBLIC_ACCOMPANIMENT_GROUPS.map((group) => group.label)).toEqual([
      'Block',
      'Natural',
      'Variation',
      'Arpeggio',
    ]);

    const natural = PUBLIC_ACCOMPANIMENT_GROUPS[1]!;
    const variation = PUBLIC_ACCOMPANIMENT_GROUPS[2]!;
    const arpeggio = PUBLIC_ACCOMPANIMENT_GROUPS[3]!;
    expect(natural.types.map((type) => type.label)).toEqual(['Type 1', 'Type 2']);
    expect(natural.types.map((type) => type.variant)).toEqual(['natural.type1', 'natural.type2']);
    expect(variation.types.map((type) => type.label)).toEqual(['City', 'Funk', 'Driving', 'Dance']);
    expect(variation.types.map((type) => `${type.pattern}/${type.variant}`)).toEqual([
      'city/city.type1',
      'natural/natural.type3',
      'natural/natural.type4',
      'natural/natural.dance1',
    ]);
    expect(arpeggio.types.map((type) => `${type.pattern}/${type.variant}`)).toEqual([
      'natural/natural.type5',
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

  it('keeps every displayed Style label and pattern hint in English', () => {
    const displayed = PUBLIC_ACCOMPANIMENT_GROUPS.flatMap((group) => [
      group.label,
      ...group.types.flatMap((type) => [type.label, type.hint]),
    ]);
    expect(displayed.every((text) => !/[ぁ-んァ-ン一-龠]/u.test(text))).toBe(true);
  });

  it.each([
    ['city', 'city.type1', 'Variation', 'City'],
    ['natural', 'natural.type3', 'Variation', 'Funk'],
    ['natural', 'natural.type4', 'Variation', 'Driving'],
    ['natural', 'natural.dance1', 'Variation', 'Dance'],
    ['natural', 'natural.type5', 'Arpeggio', 'Type 1'],
  ] as const)('summarizes %s/%s under its presentation parent', (pattern, variant, group, type) => {
    const common = {
      instrumentId: 'piano' as const,
      drumMode: 'off' as const,
      drumBeat: '8' as const,
    };
    expect(
      styleSummaryParts({
        ...common,
        accompanimentPattern: pattern,
        accompanimentVariant: variant,
      }).slice(0, 2),
    ).toEqual(group === 'Arpeggio' ? [group, 'Piano'] : [group, type]);
  });

  it('keeps per-chord voicing out of the global Style summary', () => {
    const summary = styleSummaryParts({
      accompanimentPattern: 'natural' as const,
      accompanimentVariant: 'natural.type1',
      instrumentId: 'piano' as const,
      drumMode: 'off' as const,
      drumBeat: '8' as const,
    });
    expect(summary).not.toContain('基本形');
    expect(summary).not.toContain('1st');
    expect(summary).not.toContain('2nd');
  });
});
