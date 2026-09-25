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
      strong: [],
    });
  });

  it('keeps the short safe row visible and folds the rest away', () => {
    const { core, extended, strong } = variationTiers(base);
    expect(core.map((p) => p.id)).toEqual(['sus2', 'sus4', 'add9', '6']);
    expect(extended.map((p) => p.id)).toEqual(['sixNine', '9']);
    // I's #11 is the Lydian F# in C — strong colour, and out of key besides.
    expect(strong.map((p) => p.preview)).toEqual(['Cmaj7(#11)', 'Cmaj9(#11)']);
  });

  it('captions each pill as the chord it produces, not the shared variation id', () => {
    expect(variationTiers(base).extended.map((p) => [p.label, p.preview])).toEqual([
      ['6/9', 'C6/9'],
      ['maj9', 'Cmaj9'],
    ]);
    expect(variationTiers({ ...base, degree: 1 }).extended.map((p) => [p.label, p.preview])).toEqual(
      [
        ['m6/9', 'Dm6/9'],
        ['m9', 'Dm9'],
        ['m11', 'Dm11'],
        ['m13', 'Dm13'],
      ],
    );
    expect(variationTiers({ ...base, degree: 4 }).extended.map((p) => [p.label, p.preview])).toEqual(
      [
        ['9', 'G9'],
        ['13', 'G13'],
      ],
    );
  });

  it('gives V the four altered dominant tones under 強い色づけ', () => {
    const { extended, strong } = variationTiers({ ...base, degree: 4 });
    expect(extended.map((p) => p.preview)).toEqual(['G9', 'G13']);
    expect(strong.map((p) => p.preview)).toEqual(['G7(♭9)', 'G7(#9)', 'G7(#11)', 'G7(♭13)']);
  });

  it('marks IV #11 as in key and I #11 as outside it', () => {
    const four = variationTiers({ ...base, degree: 3 });
    expect(four.strong.map((p) => p.scaleCompatibility)).toEqual(['inside', 'inside', 'inside']);
    expect(variationTiers(base).strong.map((p) => p.scaleCompatibility)).toEqual([
      'outside',
      'outside',
    ]);
  });

  it('makes vii° reachable and offers its clear resolution to I', () => {
    const { core, extended, strong } = variationTiers({ ...base, degree: 6, entitlements: PRO });
    expect(core.map((p) => p.preview)).toEqual(['Bm7♭5']);
    expect(extended.map((p) => p.preview)).toEqual(['Bm7♭5(11)', 'Bdim7']);
    expect(strong.map((p) => p.preview)).toEqual(['Bm7♭5(♭13)']);
  });

  it('previews the chord each pill would produce in the current key', () => {
    const { core } = variationTiers({ ...base, key: 'G' });
    expect(core.find((p) => p.id === 'add9')?.preview).toBe('Gadd9');
    const { extended } = variationTiers({ ...base, key: 'G', degree: 3 });
    expect(extended.map((p) => p.preview)).toEqual(['C6/9', 'Cmaj9']);
  });

  it('locks the Pro colours for a free player and frees them for a subscriber', () => {
    const free = variationTiers(base);
    expect(free.core.filter((p) => !p.locked).map((p) => p.id)).toEqual(['sus4', 'add9']);
    expect(free.extended.every((p) => p.locked)).toBe(true);
    expect(free.strong.every((p) => p.locked)).toBe(true);
    // vii° stays reachable for free, matching the seventh grid.
    expect(variationTiers({ ...base, degree: 6 }).core.every((p) => p.locked)).toBe(false);

    const pro = variationTiers({ ...base, entitlements: PRO });
    expect(pro.core.every((p) => !p.locked)).toBe(true);
    expect(pro.extended.every((p) => !p.locked)).toBe(true);
    expect(pro.strong.every((p) => !p.locked)).toBe(true);
  });

  it('marks the pill the selected chord already carries', () => {
    const selected = { variation: 'add9' } as unknown as ChordEvent;
    const { core } = variationTiers({ ...base, selected });
    expect(core.filter((p) => p.active).map((p) => p.id)).toEqual(['add9']);
  });

  it('marks a chord saved before variations were tracked, by its quality', () => {
    const selected = { suffix: 'maj9' } as unknown as ChordEvent;
    const { extended } = variationTiers({ ...base, selected });
    expect(extended.filter((p) => p.active).map((p) => p.id)).toEqual(['9']);
  });

  it('does not confuse a core colour with the extended one built on it', () => {
    const selected = { suffix: '6' } as unknown as ChordEvent;
    const { core, extended } = variationTiers({ ...base, selected });
    expect(core.filter((p) => p.active).map((p) => p.id)).toEqual(['6']);
    expect(extended.every((p) => !p.active)).toBe(true);
  });

  it('lights nothing up for a chord whose variation is no longer offered', () => {
    // Cmaj13 left the offer; the project keeps it, so no pill may claim it.
    const selected = { suffix: 'maj13', variation: '13' } as unknown as ChordEvent;
    const tiers = variationTiers({ ...base, selected });
    for (const row of [tiers.core, tiers.extended, tiers.strong]) {
      expect(row.every((p) => !p.active)).toBe(true);
    }
  });
});

describe('variationTiers — natural minor', () => {
  const minor = { ...base, mode: 'minor' as const, entitlements: PRO };

  it('uses i Aeolian available tensions and separates its avoid ♭13', () => {
    const tiers = variationTiers(minor);

    expect(tiers.core.map((pill) => pill.preview)).toEqual(['Csus2', 'Csus4', 'Cm(add9)']);
    expect(tiers.extended.map((pill) => pill.preview)).toEqual(['Cm9', 'Cm11']);
    expect(tiers.strong.map((pill) => pill.preview)).toEqual(['Cm7(♭13)']);
  });

  it('gives iiø only its sourced 11 and ♭13 extensions', () => {
    const tiers = variationTiers({ ...minor, degree: 1 });

    expect(tiers.core).toEqual([]);
    expect(tiers.extended.map((pill) => pill.preview)).toEqual(['Dm7♭5(11)', 'Dm7♭5(♭13)']);
    expect(tiers.strong.map((pill) => pill.preview)).toEqual(['Dm7♭5(♭9)']);
  });

  it('keeps natural-minor v minor and refuses its avoid ♭9/♭13 in the safe rows', () => {
    const tiers = variationTiers({ ...minor, degree: 4 });

    expect(tiers.core.map((pill) => pill.preview)).toEqual(['Gsus4', 'Gm(add11)']);
    expect(tiers.strong.map((pill) => pill.preview)).toEqual(['Gm7(♭9)', 'Gm7(♭13)']);
  });

  it('offers Lydian #11 on ♭VI as strong colour, in key though it is', () => {
    const tiers = variationTiers({ ...minor, degree: 5 });

    expect(tiers.extended.map((pill) => pill.preview)).toEqual(['A♭6/9', 'A♭maj9', 'A♭maj13']);
    expect(tiers.strong.map((pill) => pill.preview)).toEqual(['A♭maj9(#11)', 'A♭maj13(#11)']);
    expect(tiers.strong.every((pill) => pill.scaleCompatibility === 'inside')).toBe(true);
  });

  it('captions minor degrees by their own quality', () => {
    expect(variationTiers(minor).extended.map((pill) => pill.label)).toEqual(['m9', 'm11']);
    expect(variationTiers({ ...minor, degree: 2 }).extended.map((pill) => pill.label)).toEqual([
      '6/9',
      'maj9',
      'maj13',
    ]);
  });
});
