import { DEFAULT_ACCOMPANIMENT, normalizeAccompaniment } from '@/lib/accompaniment';
import { CORE_PATTERNS } from '@/lib/performance/model/styleCards';

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

  it('defaults to a pattern the Style screen actually offers', () => {
    expect(DEFAULT_ACCOMPANIMENT).toBe('block');
    expect(CORE_PATTERNS).toContain(DEFAULT_ACCOMPANIMENT);
  });

  it('falls back to the default for unknown or non-string input', () => {
    for (const raw of ['bogus', '', undefined, null, 42, {}]) {
      expect(normalizeAccompaniment(raw)).toBe(DEFAULT_ACCOMPANIMENT);
    }
  });

  it('is idempotent (normalizing a normalized value is a no-op)', () => {
    for (const raw of ['eightBeat', 'sixteenthBeat', 'block', 'arpeggio', 'natural', 'x']) {
      const once = normalizeAccompaniment(raw);
      expect(normalizeAccompaniment(once)).toBe(once);
    }
  });
});
