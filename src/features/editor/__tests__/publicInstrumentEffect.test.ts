import { getSession, setInstrumentEffect, setReleaseCut } from '@/features/editor/session';

describe('editor public instrument-effect boundary', () => {
  it('normalizes a stored release-cut effect to sustain', () => {
    setInstrumentEffect('releaseCut');

    expect(getSession().instrumentEffect).toBe('sustain');
    expect(getSession().releaseCut).toBe(false);
  });

  it('normalizes the legacy release-cut flag to sustain', () => {
    setReleaseCut(true);

    expect(getSession().instrumentEffect).toBe('sustain');
    expect(getSession().releaseCut).toBe(false);
  });
});
