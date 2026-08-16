import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { playbackTestSessionInput } from '@/lib/playback/fixtures';
import { CORE_PATTERNS } from '@/lib/performance/model/styleCards';
import { variantsFor } from '@/lib/performance/variants';
import {
  HARD_RANGE,
  PREFERRED_RANGE,
  clampToHardLimit,
  foldPcToWindow,
  optimizeAttack,
  resolveAllowed,
  voicePartFor,
} from '@/lib/performance/strictV2';

describe('register policy', () => {
  it('maps template notes onto bass / inner / top', () => {
    expect(voicePartFor({ voicingPosition: 'lowest', chordRole: 'root' })).toBe('bass');
    expect(voicePartFor({ voicingPosition: 'inner' })).toBe('inner');
    expect(voicePartFor({ voicingPosition: 'top' })).toBe('top');
    expect(voicePartFor({ registerHint: 'high' })).toBe('top');
  });

  it('folds a pitch class into the preferred window near the centre', () => {
    const c = foldPcToWindow(0, PREFERRED_RANGE);
    expect(c).toBeGreaterThanOrEqual(PREFERRED_RANGE.lo);
    expect(c).toBeLessThanOrEqual(PREFERRED_RANGE.hi);
    expect(c % 12).toBe(0);
    expect(Math.abs(c - PREFERRED_RANGE.center)).toBeLessThanOrEqual(6);
  });

  it('octave-folds outliers into the hard limit without leaving G1–C5', () => {
    expect(clampToHardLimit(95)).toBeLessThanOrEqual(HARD_RANGE.hi);
    expect(clampToHardLimit(24)).toBeGreaterThanOrEqual(HARD_RANGE.lo);
    expect(clampToHardLimit(95) % 12).toBe(95 % 12);
  });

  it('keeps an optimized attack inside the hard limit', () => {
    const allowed = resolveAllowed({
      symbol: 'C',
      rootPc: 0,
      quality: 'major',
      chordIntervals: [0, 4, 7],
    });
    const result = optimizeAttack(
      [
        { chordRole: 'root', voicingPosition: 'lowest', registerHint: 'low', absolutePitch: 36 },
        { chordRole: 'third', voicingPosition: 'inner', registerHint: 'mid', absolutePitch: 64 },
        { chordRole: 'fifth', voicingPosition: 'top', registerHint: 'high', absolutePitch: 91 },
      ],
      allowed,
      { prevPitches: null, prevBass: null, prevTop: null, prevChordPcs: null },
    );
    expect(result.pitches.every((p) => p >= HARD_RANGE.lo && p <= HARD_RANGE.hi)).toBe(true);
    expect(result.pitches.every((p) => allowed.containsPitch(p))).toBe(true);
  });

  it('keeps production Human Template chord tones legal (register is not a pitch rewrite)', () => {
    for (const pattern of CORE_PATTERNS) {
      const variant = variantsFor(pattern)[0]!;
      const plan = buildSessionPerformancePlan(
        playbackTestSessionInput(pattern, variant.id),
        'pro',
      );
      const pitched = plan.notes.filter((n) => n.trackId === 'chord' || n.trackId === 'top');
      expect(pitched.length).toBeGreaterThan(0);
      const chordIllegal = (plan.harmonyViolations ?? []).filter(
        (v) => v.trackId === 'chord' || v.trackId === 'top',
      );
      expect(chordIllegal).toEqual([]);
    }
  });
});
