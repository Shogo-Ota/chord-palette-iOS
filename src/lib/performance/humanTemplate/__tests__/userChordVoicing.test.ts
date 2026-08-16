import { resolveAllowed } from '../../strictV2';
import { compileProductionNote } from '../degreePitch';
import { realizeUserChordAttack } from '../userChordVoicing';

const C = resolveAllowed({ symbol: 'C', rootPc: 0, quality: 'maj', chordIntervals: [0, 4, 7] });
const Cmaj7 = resolveAllowed({
  symbol: 'Cmaj7',
  rootPc: 0,
  quality: 'maj',
  chordIntervals: [0, 4, 7, 11],
});
const Am = resolveAllowed({ symbol: 'Am', rootPc: 9, quality: 'min', chordIntervals: [0, 3, 7] });

function note(absolutePitch: number, rootPc: number, intervals: readonly number[]) {
  return compileProductionNote(
    { absolutePitch, durationBeats: 1, velocity: 80 },
    { symbol: '', rootPc, quality: 'maj', chordIntervals: intervals },
  );
}

describe('realizeUserChordAttack', () => {
  it('does not import teacher 7th/9th onto a triad', () => {
    const source = [0, 4, 7] as const;
    const notes = [48, 52, 55, 59, 62].map((p) => note(p, 0, source));
    const pitches = realizeUserChordAttack(notes, C);
    expect(pitches).toHaveLength(5);
    expect(new Set(pitches).size).toBe(5);
    for (const p of pitches) expect(C.containsPitch(p)).toBe(true);
    expect(pitches.some((p) => p % 12 === 11)).toBe(false);
    expect(pitches.some((p) => p % 12 === 2)).toBe(false);
  });

  it('keeps a 7th when the user wrote maj7', () => {
    const notes = [48, 52, 55, 59].map((p) => note(p, 0, [0, 4, 7]));
    const pitches = realizeUserChordAttack(notes, Cmaj7);
    expect(pitches.some((p) => p % 12 === 11)).toBe(true);
    for (const p of pitches) expect(Cmaj7.containsPitch(p)).toBe(true);
  });

  it('preserves contour and forbids crossing or unison', () => {
    const notes = [36, 52, 60, 67].map((p) => note(p, 0, [0, 4, 7]));
    const pitches = realizeUserChordAttack(notes, Am);
    expect(pitches[0]!).toBeLessThan(pitches[1]!);
    expect(pitches[1]!).toBeLessThan(pitches[2]!);
    expect(pitches[2]!).toBeLessThan(pitches[3]!);
    expect(new Set(pitches).size).toBe(4);
    for (const p of pitches) expect(Am.containsPitch(p)).toBe(true);
  });
});
