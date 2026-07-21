import { DEFAULT_ACCOMPANIMENT, normalizeAccompaniment } from '@/lib/accompaniment';

describe('normalizeAccompaniment', () => {
  it('migrates the retired 8beat id → natural', () => {
    expect(normalizeAccompaniment('eightBeat')).toBe('natural');
  });

  it('migrates the retired 16beat id → driving', () => {
    expect(normalizeAccompaniment('sixteenthBeat')).toBe('driving');
  });

  it('passes block / arpeggio through unchanged', () => {
    expect(normalizeAccompaniment('block')).toBe('block');
    expect(normalizeAccompaniment('arpeggio')).toBe('arpeggio');
  });

  it('passes the three feels through unchanged', () => {
    for (const id of ['natural', 'driving', 'relaxed'] as const) {
      expect(normalizeAccompaniment(id)).toBe(id);
    }
  });

  it('falls back to natural for unknown or non-string input', () => {
    expect(DEFAULT_ACCOMPANIMENT).toBe('natural');
    expect(normalizeAccompaniment('bogus')).toBe('natural');
    expect(normalizeAccompaniment('')).toBe('natural');
    expect(normalizeAccompaniment(undefined)).toBe('natural');
    expect(normalizeAccompaniment(null)).toBe('natural');
    expect(normalizeAccompaniment(42)).toBe('natural');
    expect(normalizeAccompaniment({})).toBe('natural');
  });

  it('is idempotent (normalizing a normalized value is a no-op)', () => {
    for (const raw of ['eightBeat', 'sixteenthBeat', 'block', 'arpeggio', 'natural', 'x']) {
      const once = normalizeAccompaniment(raw);
      expect(normalizeAccompaniment(once)).toBe(once);
    }
  });
});
