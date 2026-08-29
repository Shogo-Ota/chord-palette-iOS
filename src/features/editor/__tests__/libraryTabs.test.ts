import {
  libraryTabOptions,
  libraryTabsFor,
  resolveLibraryTab,
  supportsAdvancedTiers,
} from '@/features/editor/libraryTabs';

describe('library tabs per key mode', () => {
  it('offers the full set in major', () => {
    expect(libraryTabsFor('major')).toEqual(['diatonic', 'advanced', 'slash']);
    expect(supportsAdvancedTiers('major')).toBe(true);
  });

  it('offers 応用 in minor through its dedicated provider', () => {
    expect(libraryTabsFor('minor')).toEqual(['diatonic', 'advanced', 'slash']);
    expect(supportsAdvancedTiers('minor')).toBe(true);
  });

  it('keeps オンコード in minor — slash bass is degree-agnostic', () => {
    expect(libraryTabsFor('minor')).toContain('slash');
  });

  it('labels every offered tab', () => {
    expect(libraryTabOptions('minor')).toEqual([
      { key: 'diatonic', label: 'ダイアトニック' },
      { key: 'advanced', label: '応用' },
      { key: 'slash', label: 'オンコード' },
    ]);
  });

  it('leaves a valid tab where it is in either mode', () => {
    expect(resolveLibraryTab('slash', 'minor')).toBe('slash');
    expect(resolveLibraryTab('advanced', 'minor')).toBe('advanced');
    expect(resolveLibraryTab('advanced', 'major')).toBe('advanced');
  });
});
