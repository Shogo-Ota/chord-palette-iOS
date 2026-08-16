import {
  DEFAULT_PUBLIC_ACCOMPANIMENT,
  DEFAULT_PUBLIC_VARIANT,
  normalizePublicAccompanimentSelection,
  PUBLIC_ACCOMPANIMENT_PATTERNS,
} from '../publicAccompaniment';

describe('public accompaniment release policy', () => {
  it('offers Block, Natural and listening-approved City Type1', () => {
    expect(PUBLIC_ACCOMPANIMENT_PATTERNS).toEqual(['block', 'natural', 'city']);
    expect(DEFAULT_PUBLIC_ACCOMPANIMENT).toBe('natural');
    expect(DEFAULT_PUBLIC_VARIANT).toBe('natural.type1');

    expect(normalizePublicAccompanimentSelection('block', 'block.type1')).toEqual({
      accompanimentPattern: 'block',
      accompanimentVariant: 'block.type1',
    });
    expect(
      ['natural.type1', 'natural.type2', 'natural.type3'].map(
        (variant) => normalizePublicAccompanimentSelection('natural', variant).accompanimentVariant,
      ),
    ).toEqual(['natural.type1', 'natural.type2', 'natural.type3']);
    expect(normalizePublicAccompanimentSelection('city', 'city.type1')).toEqual({
      accompanimentPattern: 'city',
      accompanimentVariant: 'city.type1',
    });
    expect(normalizePublicAccompanimentSelection('city', 'city.experimental')).toEqual({
      accompanimentPattern: 'city',
      accompanimentVariant: 'city.type1',
    });
  });

  it('falls hidden patterns and variants back to Natural Type1', () => {
    expect(normalizePublicAccompanimentSelection('arpeggio', 'arpeggio.type1')).toEqual({
      accompanimentPattern: 'natural',
      accompanimentVariant: 'natural.type1',
    });
    expect(normalizePublicAccompanimentSelection('natural', 'natural.auto')).toEqual({
      accompanimentPattern: 'natural',
      accompanimentVariant: 'natural.type1',
    });
  });
});
