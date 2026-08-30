import { variationTiers } from '@/features/editor/variationPills';
import type { Entitlements } from '@/lib/entitlements';
import type { ChordEvent } from '@/types';

const FREE: Entitlements = { palettePro: false, communityPlus: false };
const PRO: Entitlements = { palettePro: true, communityPlus: false };

const base = {
  key: 'C',
  mode: 'major',
  degree: 0,
  selected: undefined,
  entitlements: FREE,
} as const;

describe('variationTiers', () => {
  it('has nothing to offer a chord that is not on a degree', () => {
    expect(variationTiers({ ...base, degree: -1 })).toEqual({
      core: [],
      extended: [],
      altered: [],
    });
  });

  it('keeps the familiar row in the core tier and the rest folded away', () => {
    const { core, extended, altered } = variationTiers(base);
    expect(core.map((p) => p.id)).toEqual(['sus4', 'add9', '6', 'sus2', '9', '13']);
    expect(extended.map((p) => p.id)).toEqual(['sixNine']);
    // I's #11 is the Lydian F# in C — out of key, so it lands in the altered tier.
    expect(altered.map((p) => p.id)).toEqual(['maj9sharp11', 'maj13sharp11']);
  });

  it('gives V the four altered dominant tones and no in-key colours', () => {
    const { extended, altered } = variationTiers({ ...base, degree: 4 });
    expect(extended).toEqual([]);
    expect(altered.map((p) => p.preview)).toEqual(['G7(♭9)', 'G7(#9)', 'G7(#11)', 'G7(♭13)']);
  });

  it('separates IV in-key #11 from I out-of-key #11', () => {
    const four = variationTiers({ ...base, degree: 3 });
    expect(four.extended.map((p) => p.id)).toContain('maj9sharp11');
    expect(four.altered).toEqual([]);
  });

  it('previews the chord each pill would produce in the current key', () => {
    const { core } = variationTiers({ ...base, key: 'G' });
    expect(core.find((p) => p.id === 'add9')?.preview).toBe('Gadd9');
    const { extended } = variationTiers({ ...base, key: 'G', degree: 3 });
    expect(extended.map((p) => p.preview)).toEqual(['C6/9', 'Cmaj9(#11)', 'Cmaj13(#11)']);
  });

  it('locks the Pro colours for a free player and frees them for a subscriber', () => {
    const free = variationTiers(base);
    expect(free.core.filter((p) => !p.locked).map((p) => p.id)).toEqual(['sus4', 'add9']);
    expect(free.extended.every((p) => p.locked)).toBe(true);
    expect(free.altered.every((p) => p.locked)).toBe(true);

    const pro = variationTiers({ ...base, entitlements: PRO });
    expect(pro.core.every((p) => !p.locked)).toBe(true);
    expect(pro.extended.every((p) => !p.locked)).toBe(true);
    expect(pro.altered.every((p) => !p.locked)).toBe(true);
  });

  it('marks the pill the selected chord already carries', () => {
    const selected = { variation: 'add9' } as unknown as ChordEvent;
    const { core } = variationTiers({ ...base, selected });
    expect(core.filter((p) => p.active).map((p) => p.id)).toEqual(['add9']);
  });

  it('marks a chord saved before variations were tracked, by its quality', () => {
    const selected = { suffix: 'maj9' } as unknown as ChordEvent;
    const { core } = variationTiers({ ...base, selected });
    expect(core.filter((p) => p.active).map((p) => p.id)).toEqual(['9']);
  });

  it('does not confuse a core colour with the extended one built on it', () => {
    const selected = { suffix: '6' } as unknown as ChordEvent;
    const { core, extended } = variationTiers({ ...base, selected });
    expect(core.filter((p) => p.active).map((p) => p.id)).toEqual(['6']);
    expect(extended.every((p) => !p.active)).toBe(true);
  });
});

describe('variationTiers — natural minor', () => {
  const minor = { ...base, mode: 'minor' as const, entitlements: PRO };

  it('uses i Aeolian available tensions and separates its avoid ♭13', () => {
    const tiers = variationTiers(minor);

    expect(tiers.core.map((pill) => pill.preview)).toEqual([
      'Csus4',
      'Cm(add9)',
      'Csus2',
      'Cm9',
      'Cm11',
    ]);
    expect(tiers.altered.map((pill) => pill.preview)).toEqual(['Cm7(♭13)']);
  });

  it('gives iiø only its sourced 11 and ♭13 extensions', () => {
    const tiers = variationTiers({ ...minor, degree: 1 });

    expect(tiers.core).toEqual([]);
    expect(tiers.extended.map((pill) => pill.preview)).toEqual(['Dm7♭5(11)', 'Dm7♭5(♭13)']);
    expect(tiers.altered.map((pill) => pill.preview)).toEqual(['Dm7♭5(♭9)']);
  });

  it('keeps natural-minor v minor and refuses its avoid ♭9/♭13 in core', () => {
    const tiers = variationTiers({ ...minor, degree: 4 });

    expect(tiers.core.map((pill) => pill.preview)).toEqual(['Gsus4', 'Gm(add11)']);
    expect(tiers.altered.map((pill) => pill.preview)).toEqual(['Gm7(♭9)', 'Gm7(♭13)']);
  });

  it('offers Lydian #11 on ♭VI as an available extension', () => {
    const tiers = variationTiers({ ...minor, degree: 5 });

    expect(tiers.extended.map((pill) => pill.preview)).toEqual([
      'A♭6/9',
      'A♭maj9(#11)',
      'A♭maj13(#11)',
    ]);
    expect(tiers.altered).toEqual([]);
  });
});
