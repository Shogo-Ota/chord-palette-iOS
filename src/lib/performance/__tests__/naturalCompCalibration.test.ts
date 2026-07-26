import { gateRangeFor } from '../articulation';
import { GT_001 } from '../groundTruth';
import { NATURAL_COMP } from '../styles/naturalComp';
import { NATURAL_COMP_DENSE } from '../styles/naturalCompDense';
import { NATURAL_COMP_SPARSE } from '../styles/naturalCompSparse';
import type { StepPattern, StylePreset } from '../styles/types';

/**
 * What a note of the given track lands on before the phrase arc and per-note
 * humanize — the same arithmetic `computeVelocity` applies, using the pattern's
 * typical accent. This is the number that should agree with the reference.
 */
function typicalVelocity(style: StylePreset, track: 'chord' | 'bass'): number {
  const pattern: StepPattern = style[track];
  const hits = pattern.accent.filter((_, i) => pattern.hits[i]);
  const meanAccent = hits.reduce((a, b) => a + b, 0) / hits.length;
  return style.velocity.center[track] + (meanAccent - 0.6) * style.velocity.accentDepth;
}

describe('Natural comp follows GT-001', () => {
  it('plays its chord quarters at the reference downbeat level', () => {
    expect(typicalVelocity(NATURAL_COMP, 'chord')).toBeCloseTo(GT_001.velocity.downbeat, 0);
  });

  it('plays its walking bass at the reference upbeat level', () => {
    expect(typicalVelocity(NATURAL_COMP, 'bass')).toBeCloseTo(GT_001.velocity.upbeat, 0);
  });

  it('separates the two roles by about as much as the reference does', () => {
    const spread = typicalVelocity(NATURAL_COMP, 'chord') - typicalVelocity(NATURAL_COMP, 'bass');
    const reference = GT_001.velocity.downbeat - GT_001.velocity.upbeat;
    expect(Math.abs(spread - reference)).toBeLessThan(1.5);
  });

  it('rolls block chords no wider than the reference', () => {
    expect(NATURAL_COMP.strum?.spreadMs).toBeLessThanOrEqual(
      Math.ceil(GT_001.strum.p75SpreadMs),
    );
  });

  it('stays on the grid like the reference', () => {
    for (const track of ['chord', 'bass', 'kick'] as const) {
      const w = NATURAL_COMP.microtiming[track];
      expect(Math.max(Math.abs(w.min), Math.abs(w.max))).toBeLessThanOrEqual(3);
    }
  });

  it('holds each register for its own reference note length', () => {
    // The gate is a fraction of the nominal length, and both patterns strike once a
    // beat on this grid — so a gate reads directly as a length in beats.
    const cases = [
      { track: 'chord', band: GT_001.noteLength.mid },
      { track: 'bass', band: GT_001.noteLength.bass },
    ] as const;
    for (const { track, band } of cases) {
      const { min, max } = gateRangeFor(NATURAL_COMP, track);
      expect(band.median).toBeGreaterThanOrEqual(min);
      expect(band.median).toBeLessThanOrEqual(max);
    }
  });

  it('gives the bass its own window rather than clipping it to the chords', () => {
    const chord = gateRangeFor(NATURAL_COMP, 'chord');
    const bass = gateRangeFor(NATURAL_COMP, 'bass');
    expect(bass).not.toEqual(chord);
    expect(bass.max).toBeGreaterThan(chord.max);
  });
});

describe('the Natural bank stays one player', () => {
  it('shares the calibrated dynamics across every variant', () => {
    for (const variant of [NATURAL_COMP_SPARSE, NATURAL_COMP_DENSE]) {
      expect(variant.velocity).toEqual(NATURAL_COMP.velocity);
      expect(variant.gate).toEqual(NATURAL_COMP.gate);
      expect(variant.strum).toEqual(NATURAL_COMP.strum);
      expect(variant.microtiming).toEqual(NATURAL_COMP.microtiming);
    }
  });
});
