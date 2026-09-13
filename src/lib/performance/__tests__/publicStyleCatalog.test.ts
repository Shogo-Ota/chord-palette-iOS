import {
  publicStyleExportLabel,
  publicStyleFor,
  publicStyleGroupFor,
  PUBLIC_STYLE_GROUPS,
  PUBLIC_STYLES,
} from '../publicStyleCatalog';
import { resolveVariant } from '../variants';

describe('public STYLE catalog', () => {
  it('offers the eight release STYLEs in screen order', () => {
    expect(PUBLIC_STYLE_GROUPS.map((group) => group.label)).toEqual([
      'Block',
      'Natural',
      'Variation',
      'Arpeggio',
    ]);
    expect(PUBLIC_STYLES.map((style) => `${style.groupLabel}/${style.typeLabel}`)).toEqual([
      'Block/Type 1',
      'Natural/Type 1',
      'Natural/Type 2',
      'Variation/City',
      'Variation/Funk',
      'Variation/Driving',
      'Variation/Dance',
      'Arpeggio/Type 1',
    ]);
  });

  it.each([
    ['block', 'block.type1', 'Block'],
    ['natural', 'natural.type1', 'Natural-Type1'],
    ['natural', 'natural.type2', 'Natural-Type2'],
    ['city', 'city.type1', 'Variation-City'],
    ['natural', 'natural.type3', 'Variation-Funk'],
    ['natural', 'natural.type4', 'Variation-Driving'],
    ['natural', 'natural.dance1', 'Variation-Dance'],
    ['natural', 'natural.type5', 'Arpeggio'],
  ] as const)('exports %s/%s as %s', (pattern, variant, label) => {
    expect(publicStyleExportLabel(pattern, variant)).toBe(label);
  });

  it('keeps every export label free of spaces and separators', () => {
    for (const style of PUBLIC_STYLES) {
      expect(publicStyleExportLabel(style.pattern, style.variant)).toMatch(/^[A-Za-z0-9]+(-[A-Za-z0-9]+)?$/);
    }
  });

  it('binds each STYLE to a variant the engine resolves to itself', () => {
    for (const style of PUBLIC_STYLES) {
      expect(resolveVariant(style.pattern, style.variant).id).toBe(style.variant);
    }
  });

  it('settles an unknown or retired selection on the engine default', () => {
    expect(publicStyleFor('natural', 'natural.retired').variant).toBe('natural.type1');
    expect(publicStyleGroupFor('natural', undefined).id).toBe('natural');
    expect(publicStyleFor('relaxed', 'relaxed.type1').groupId).toBe('natural');
  });
});
