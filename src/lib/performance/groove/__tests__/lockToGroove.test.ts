import { profileFor, type DrumProfile } from '@/lib/performance/groove/drumProfiles';
import { lockToGroove, swingFractionForTempo } from '@/lib/performance/groove/lockToGroove';
import { EIGHT_BEAT } from '@/lib/performance/styles/eightBeat';
import { NATURAL_COMP } from '@/lib/performance/styles/naturalComp';
import type { StylePreset } from '@/lib/performance/styles/types';

const BPM = 120;
const clone = (s: StylePreset): StylePreset => JSON.parse(JSON.stringify(s));

/** Synthetic swing groove — the built-in Swing groove was retired, but the generic
 *  swing-lock mechanism must still respond if a future groove sets `swing: true`. */
const SWING_PROFILE: DrumProfile = {
  grooveId: 'test-swing',
  family: 'swing',
  kickBeats: [0, 2],
  snareBeats: [1, 3],
  swing: true,
};

describe('lockToGroove — rhythm preservation (the Feel keeps its identity)', () => {
  it('never adds or removes hits / ghosts on any track', () => {
    for (const groove of ['pop8', 'pop16', 'rock8', 'rock16', 'soul16', 'bossaNova']) {
      const locked = lockToGroove(NATURAL_COMP, profileFor(groove), BPM);
      expect(locked.chord.hits).toEqual(NATURAL_COMP.chord.hits);
      expect(locked.bass.hits).toEqual(NATURAL_COMP.bass.hits);
      expect(locked.chord.ghost).toEqual(NATURAL_COMP.chord.ghost);
      expect(locked.bass.ghost).toEqual(NATURAL_COMP.bass.ghost);
      // stepsPerBar / gate / velocity / microtiming are render-critical and untouched.
      expect(locked.gate).toEqual(NATURAL_COMP.gate);
      expect(locked.velocity).toEqual(NATURAL_COMP.velocity);
      expect(locked.microtiming).toEqual(NATURAL_COMP.microtiming);
    }
  });

  it('is pure — it does not mutate the input template', () => {
    const before = clone(NATURAL_COMP);
    lockToGroove(NATURAL_COMP, profileFor('pop8'), BPM);
    expect(NATURAL_COMP).toEqual(before);
  });

  it('is deterministic — same inputs ⇒ identical output', () => {
    const a = lockToGroove(EIGHT_BEAT, profileFor('rock16'), BPM);
    const b = lockToGroove(EIGHT_BEAT, profileFor('rock16'), BPM);
    expect(a).toEqual(b);
  });
});

describe('lockToGroove — backbeat accent lock (chord agrees with the snare)', () => {
  it('bumps chord accents that land on 2 & 4, capping at 1, and leaves others alone', () => {
    // NATURAL_COMP chord = straight quarters (steps 0/2/4/6 = beats 0/1/2/3).
    // Backbeat = beats 1 & 3 = steps 2 & 6.
    const locked = lockToGroove(NATURAL_COMP, profileFor('pop8'), BPM);
    // step2 (beat 1) 1.0 + 0.06 → capped at 1.0; step6 (beat 3) 0.92 + 0.06 → 0.98.
    expect(locked.chord.accent[2]).toBeCloseTo(1.0, 6);
    expect(locked.chord.accent[6]).toBeCloseTo(0.98, 6);
    // Down-beats 1 & 3 (steps 0 & 4) are NOT the backbeat → untouched.
    expect(locked.chord.accent[0]).toBeCloseTo(NATURAL_COMP.chord.accent[0], 6);
    expect(locked.chord.accent[4]).toBeCloseTo(NATURAL_COMP.chord.accent[4], 6);
  });

  it('bossaNova (no backbeat snare) still locks the chord to the universal 2 & 4', () => {
    const locked = lockToGroove(NATURAL_COMP, profileFor('bossaNova'), BPM);
    expect(locked.chord.accent[2]).toBeGreaterThan(NATURAL_COMP.chord.accent[2] - 1e-9);
    expect(locked.chord.accent[6]).toBeCloseTo(0.98, 6);
  });
});

describe('lockToGroove — kick lock (bass agrees with the kick)', () => {
  it('bumps bass accents that land on a groove kick beat, leaving off-kick hits alone', () => {
    // EIGHT_BEAT bass hits steps 0/4/7 = beats 0/2/3.5. pop8 kicks on beats 0 & 2.
    const locked = lockToGroove(EIGHT_BEAT, profileFor('pop8'), BPM);
    // step0 accent is already 1.0 → +0.05 stays capped at 1.0.
    expect(locked.bass.accent[0]).toBeCloseTo(Math.min(1, EIGHT_BEAT.bass.accent[0] + 0.05), 6);
    // step4 accent 0.85 → 0.90.
    expect(locked.bass.accent[4]).toBeCloseTo(EIGHT_BEAT.bass.accent[4] + 0.05, 6);
    // Beat 3.5 (step 7) is not a kick → unchanged.
    expect(locked.bass.accent[7]).toBeCloseTo(EIGHT_BEAT.bass.accent[7], 6);
  });
});

describe('lockToGroove — swing spec (comp rides the cymbal long-short)', () => {
  it('sets a swing spec ONLY on swing grooves (profile.swing === true)', () => {
    expect(lockToGroove(NATURAL_COMP, SWING_PROFILE, BPM).swing).toBeDefined();
    // bossaNova is a straight-8th latin groove (swing:false) → no swing.
    expect(lockToGroove(NATURAL_COMP, profileFor('bossaNova'), BPM).swing).toBeUndefined();
    expect(lockToGroove(NATURAL_COMP, profileFor('pop8'), BPM).swing).toBeUndefined();
    expect(lockToGroove(NATURAL_COMP, profileFor('pop16'), BPM).swing).toBeUndefined();
  });

  it('never touches the microtiming jitter windows (swing is a separate, directed layer)', () => {
    expect(lockToGroove(EIGHT_BEAT, SWING_PROFILE, BPM).microtiming).toEqual(EIGHT_BEAT.microtiming);
  });
});

describe('swingFractionForTempo — Friberg & Sundström tempo dependence', () => {
  it('is heavier (more swing) at slow tempo and lighter at fast tempo', () => {
    const slow = swingFractionForTempo(80);
    const fast = swingFractionForTempo(180);
    expect(slow).toBeGreaterThan(fast);
  });

  it('stays locked near the triplet ride: clamped to [0.58, 2/3]', () => {
    for (const bpm of [40, 60, 80, 100, 120, 150, 180, 240]) {
      const f = swingFractionForTempo(bpm);
      expect(f).toBeGreaterThanOrEqual(0.58 - 1e-9);
      expect(f).toBeLessThanOrEqual(2 / 3 + 1e-9);
    }
  });

  it('reaches the triplet (2/3) at medium tempo', () => {
    // ratio 2.0 (triple feel) occurs at 130 bpm in our anchoring → fraction 2/3.
    expect(swingFractionForTempo(130)).toBeCloseTo(2 / 3, 6);
  });
});
