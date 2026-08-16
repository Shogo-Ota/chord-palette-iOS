import {
  DEFAULT_PUBLIC_INSTRUMENT_EFFECT,
  normalizePublicInstrumentEffect,
} from '@/lib/performance/effect';

describe('public instrument-effect release policy', () => {
  it('publishes sustain as the only approved effect', () => {
    expect(DEFAULT_PUBLIC_INSTRUMENT_EFFECT).toBe('sustain');
    expect(normalizePublicInstrumentEffect('sustain')).toBe('sustain');
  });

  it('falls release cut and legacy values back to sustain', () => {
    expect(normalizePublicInstrumentEffect('releaseCut')).toBe('sustain');
    expect(normalizePublicInstrumentEffect('off')).toBe('sustain');
    expect(normalizePublicInstrumentEffect(undefined)).toBe('sustain');
  });
});
