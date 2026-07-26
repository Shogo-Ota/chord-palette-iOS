import features from '../../../../docs/midi-references/GT-001_125BPM_allday_Piano.features.json';
import { accentSpreadMidi, GT_001, velocitySpreadMidi } from '../groundTruth';

/**
 * The constants are a hand-transcribed digest of the analysis artifact, so they can
 * silently drift from it. Checking them against the committed features JSON keeps
 * the two honest: re-running the analyzer and forgetting to update the digest fails
 * here rather than quietly re-tuning a feel.
 */
describe('GT_001 matches the committed analysis', () => {
  it('carries the measured tempo', () => {
    expect(GT_001.provenance.tempoBpm).toBe(features.bpm_tempo_meta);
  });

  it('carries the measured velocity by role', () => {
    expect(GT_001.velocity.downbeat).toBe(features.velocity_by_role.downbeat.median);
    expect(GT_001.velocity.upbeat).toBe(features.velocity_by_role.upbeat.median);
    expect(GT_001.velocity.sixteenthOff).toBe(features.velocity_by_role.sixteenth_off.median);
  });

  it('carries the measured velocity spread', () => {
    expect(GT_001.velocity.p25).toBe(features.velocity_overall.p25);
    expect(GT_001.velocity.median).toBe(features.velocity_overall.median);
    expect(GT_001.velocity.p75).toBe(features.velocity_overall.p75);
  });

  it('carries the measured onset distribution', () => {
    expect(GT_001.onsets.onBeat).toBe(features.onset_pct.on_beat);
    expect(GT_001.onsets.and).toBe(features.onset_pct.and);
    expect(GT_001.onsets.sixteenth).toBe(features.onset_pct.e_a);
  });

  it('carries the measured chord roll spread', () => {
    expect(GT_001.strum.medianSpreadMs).toBe(features.cluster_spread_ms.median);
    expect(GT_001.strum.p75SpreadMs).toBe(features.cluster_spread_ms.p75);
    expect(GT_001.strum.meanSpreadMs).toBeCloseTo(features.cluster_spread_ms.mean, 1);
  });

  it('carries the measured note length of both registers', () => {
    for (const band of ['mid', 'bass'] as const) {
      expect(GT_001.noteLength[band]).toEqual({
        p25: features.duration_beats_by_band[band].p25,
        median: features.duration_beats_by_band[band].median,
        p75: features.duration_beats_by_band[band].p75,
      });
    }
  });
});

describe('what GT-001 implies for a template', () => {
  it('separates metrical roles by only a few velocity steps', () => {
    expect(accentSpreadMidi(GT_001)).toBeCloseTo(4.5, 1);
  });

  it('keeps its dynamics in a narrow band', () => {
    expect(velocitySpreadMidi(GT_001)).toBeCloseTo(7.5, 1);
  });

  it('is quantized rather than pushed or laid back', () => {
    expect(GT_001.timing.medianOffsetMs).toBe(0);
    expect(Math.abs(GT_001.timing.meanOffsetMs)).toBeLessThan(5);
  });

  it('is straight, not swung', () => {
    expect(GT_001.swingRatio).toBe(0.5);
  });

  it('is driven by 16ths rather than by beats', () => {
    expect(GT_001.onsets.sixteenth).toBeGreaterThan(GT_001.onsets.onBeat);
  });
});
