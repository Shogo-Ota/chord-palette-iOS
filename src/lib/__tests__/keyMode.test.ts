import {
  DEFAULT_KEY_MODE,
  KEY_MODES,
  isMinorMode,
  keyModeLabel,
  normalizeKeyMode,
} from '@/lib/keyMode';

describe('key mode normalization', () => {
  it('offers major first and defaults to it', () => {
    expect([...KEY_MODES]).toEqual(['major', 'minor']);
    expect(DEFAULT_KEY_MODE).toBe('major');
  });

  it('accepts the two known modes', () => {
    expect(normalizeKeyMode('major')).toBe('major');
    expect(normalizeKeyMode('minor')).toBe('minor');
  });

  /**
   * Persisted values arrive as opaque strings from SQLite and from `chord_events` JSON,
   * including rows written before minor existed (null) and anything a future build might
   * add and then roll back.
   */
  it('falls back to major for anything unrecognized', () => {
    for (const value of [null, undefined, '', 'Major', 'harmonicMinor', 'dorian', 0, 1, {}, []]) {
      expect(normalizeKeyMode(value)).toBe('major');
    }
  });

  it('reports minor only for the minor mode', () => {
    expect(isMinorMode('minor')).toBe(true);
    expect(isMinorMode('major')).toBe(false);
    expect(isMinorMode(null)).toBe(false);
  });

  it('labels the modes in Japanese', () => {
    expect(keyModeLabel('major')).toBe('メジャー');
    expect(keyModeLabel('minor')).toBe('マイナー');
  });
});
