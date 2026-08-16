import { cycleDurationSec, progressionCycleDurationSec } from '@/lib/exportCycleTiming';

const progression = [
  { durationBeats: 4 as const },
  { durationBeats: 2 as const },
  { durationBeats: 1 as const },
  { durationBeats: 1 as const },
];

describe('cycleDurationSec', () => {
  it.each([
    [60, 8],
    [100, 4.8],
    [120, 4],
    [180, 8 / 3],
  ])('converts eight beats at %i BPM to an exact cycle duration', (bpm, expected) => {
    expect(cycleDurationSec(8, bpm)).toBeCloseTo(expected, 10);
  });

  it('returns zero for an empty performance', () => {
    expect(cycleDurationSec(0, 120)).toBe(0);
  });
});

describe('progressionCycleDurationSec', () => {
  it('supports mixed chord lengths in 4/4', () => {
    expect(progressionCycleDurationSec(progression, 120, 4)).toBe(4);
  });

  it('uses the same remeter scale as performance generation', () => {
    expect(progressionCycleDurationSec(progression, 120, 3)).toBe(3);
    expect(progressionCycleDurationSec(progression, 120, 6)).toBe(6);
  });

  it('does not impose a one-second minimum on short progressions', () => {
    expect(progressionCycleDurationSec([{ durationBeats: 1 }], 180, 4)).toBeCloseTo(1 / 3, 10);
  });
});
