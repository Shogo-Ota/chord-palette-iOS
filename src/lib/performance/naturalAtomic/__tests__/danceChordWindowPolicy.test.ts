import { DANCE_GROOVE_PROFILE } from '../danceGrooveProfile';
import { danceRhythmForChordWindow } from '../danceChordWindowPolicy';

const attacksForBar = (bar: number) =>
  DANCE_GROOVE_PROFILE.bars[bar % DANCE_GROOVE_PROFILE.bars.length]!;

function window(start: number, duration: number, nextBarIsSplitHalfPair = false) {
  return danceRhythmForChordWindow({
    chordStartBeat: start,
    chordDurationBeats: duration,
    beatsPerBar: 4,
    hasContiguousNextChord: true,
    nextBarIsSplitHalfPair,
    attacksForBar,
  });
}

describe('Dance chord-window placement', () => {
  it('preserves a full authored bar byte-for-byte', () => {
    expect(window(0, 4)).toEqual(DANCE_GROOVE_PROFILE.bars[0]);
  });

  it('keeps the first-half 1.75 push as a full-gate next-chord anticipation', () => {
    const attacks = window(4, 2);

    expect(attacks.map((attack) => attack.onsetBeat)).toEqual([0, 1, 1.5, 1.75]);
    expect(attacks.map((attack) => attack.durationBeat)).toEqual([1, 0.5, 0.5, 0.5]);
    expect(attacks.at(-1)?.targetChordOffset).toBe(1);
  });

  it('marks the boundary with bass only then follows the same bar second half', () => {
    const attacks = window(6, 2);

    expect(attacks.map((attack) => attack.onsetBeat)).toEqual([0, 0.5, 1.5]);
    expect(attacks.map((attack) => attack.durationBeat)).toEqual([0.5, 1, 0.5]);
    expect(attacks[0]?.selection).toEqual({ kind: 'VOICE_ROLE', role: 'BASS' });
    expect(attacks[1]?.velocityShape).toEqual(
      DANCE_GROOVE_PROFILE.bars[1].find((attack) => attack.onsetBeat === 2.5)?.velocityShape,
    );
  });

  it('advances the eight-bar phrase by physical bars, not chord count', () => {
    expect(window(20, 2).map((attack) => attack.onsetBeat)).toEqual([0, 1, 1.5, 1.75]);
    expect([
      ...new Set(window(28, 4).map((attack) => Number(attack.onsetBeat.toFixed(4)))),
    ]).toEqual([0, 0.0438, 1, 1.75, 2.5, 3, 3.5]);
  });

  it('softens only a dropout that leads into a split terminal bar', () => {
    expect(window(24, 4).map((attack) => attack.onsetBeat)).toEqual([0, 1, 1.75, 2.5, 3.5]);
    expect(window(24, 4, true).map((attack) => attack.onsetBeat)).toEqual([
      0, 1, 1.5, 1.75, 2.5, 3.5,
    ]);
    expect(window(28, 4, true).filter((attack) => attack.onsetBeat === 1.5)).toEqual([]);
  });

  it('allows only the explicit next-chord anticipation to cross a boundary', () => {
    for (const start of [0, 2, 4, 6, 12, 14, 20, 22, 28, 30]) {
      const attacks = window(start, 2);
      expect(attacks.every((attack) => attack.onsetBeat < 2)).toBe(true);
      expect(attacks.every((attack) => attack.durationBeat >= 0.5)).toBe(true);
      expect(
        attacks
          .filter((attack) => attack.onsetBeat + attack.durationBeat > 2)
          .map((attack) => [attack.onsetBeat, attack.targetChordOffset]),
      ).toEqual(start % 4 === 0 ? [[1.75, 1]] : []);
    }
  });
});
