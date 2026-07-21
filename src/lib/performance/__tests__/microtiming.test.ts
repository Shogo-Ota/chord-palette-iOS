import { barKickFeelMs, msToBeat, swingDelayBeats, trackOffsetMs } from '@/lib/performance/microtiming';
import { EIGHT_BEAT } from '@/lib/performance/styles/eightBeat';
import type { CoreTrackId, TrackId } from '@/lib/performance/NoteEvent';
import type { StylePreset } from '@/lib/performance/styles/types';

const style = EIGHT_BEAT;
const SEED = 4242;

describe('microtiming — ms↔beat conversion', () => {
  it('converts ms to beats at the given tempo', () => {
    // 120 bpm ⇒ 500ms per beat, so 250ms = 0.5 beat.
    expect(msToBeat(250, 120)).toBeCloseTo(0.5, 9);
    expect(msToBeat(0, 120)).toBe(0);
  });
});

describe('microtiming — swing delay (directed, not jitter)', () => {
  // EIGHT_BEAT is an 8th grid: even steps are on-beats, odd steps are the "&" off-beats.
  const swung: StylePreset = { ...EIGHT_BEAT, swing: { offbeatRatio: 2 / 3 } };

  it('returns 0 for every step when the style does not swing', () => {
    for (let step = 0; step < EIGHT_BEAT.stepsPerBar; step++) {
      expect(swingDelayBeats(EIGHT_BEAT, step)).toBe(0);
    }
  });

  it('pushes only the off-beat 8ths (the &) late by (offbeatRatio − 0.5) beats', () => {
    // Odd steps (1,3,5,7) = the &s at beat .5 → delayed; even steps stay on the grid.
    for (let step = 0; step < swung.stepsPerBar; step++) {
      const expected = step % 2 === 1 ? 2 / 3 - 0.5 : 0;
      expect(swingDelayBeats(swung, step)).toBeCloseTo(expected, 9);
    }
  });

  it('scales with the swing ratio (straight = no delay)', () => {
    const straight: StylePreset = { ...EIGHT_BEAT, swing: { offbeatRatio: 0.5 } };
    expect(swingDelayBeats(straight, 1)).toBeCloseTo(0, 9);
  });
});

describe('microtiming — bar-boundary drift = 0', () => {
  it('step 0 of every bar has exactly zero offset for every track', () => {
    const tracks: TrackId[] = ['chord', 'bass', 'kick', 'snare', 'hat'];
    for (let bar = 0; bar < 8; bar++) {
      for (const track of tracks) {
        expect(trackOffsetMs(SEED, bar, 0, track, style)).toBe(0);
      }
    }
  });
});

describe('microtiming — kick-referenced correlation (not independent)', () => {
  it('every track offset is the shared bar feel plus its bounded jitter', () => {
    for (let bar = 0; bar < 8; bar++) {
      const feel = barKickFeelMs(SEED, bar, style);
      for (let step = 1; step < style.stepsPerBar; step++) {
        (['kick', 'bass', 'hat', 'snare', 'chord'] as CoreTrackId[]).forEach((track) => {
          const jitter = trackOffsetMs(SEED, bar, step, track, style) - feel;
          const range = style.microtiming[track];
          expect(jitter).toBeGreaterThanOrEqual(range.min - 1e-9);
          expect(jitter).toBeLessThanOrEqual(range.max + 1e-9);
        });
      }
    }
  });

  it('bass stays within ±4ms of the kick in the same bar (design spec)', () => {
    for (let bar = 0; bar < 8; bar++) {
      for (let step = 1; step < style.stepsPerBar; step++) {
        const kick = trackOffsetMs(SEED, bar, step, 'kick', style);
        const bass = trackOffsetMs(SEED, bar, step, 'bass', style);
        expect(Math.abs(bass - kick)).toBeLessThanOrEqual(4 + 1e-9);
      }
    }
  });

  it('is fully deterministic for the same arguments', () => {
    expect(trackOffsetMs(SEED, 3, 5, 'hat', style)).toBe(trackOffsetMs(SEED, 3, 5, 'hat', style));
    // A different bar shares no state ⇒ different feel.
    expect(barKickFeelMs(SEED, 0, style)).not.toBe(barKickFeelMs(SEED, 1, style));
  });
});
