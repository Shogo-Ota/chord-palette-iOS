import { resolveAllowed } from '../../strictV2';
import { compileProductionNote } from '../degreePitch';
import { emptyVoiceLeadingState, realizeVoiceStructureAttack } from '../voiceStructureRealize';

const C = resolveAllowed({ symbol: 'C', rootPc: 0, quality: 'maj', chordIntervals: [0, 4, 7] });
const Am = resolveAllowed({ symbol: 'Am', rootPc: 9, quality: 'min', chordIntervals: [0, 3, 7] });
const Cadd9 = resolveAllowed({
  symbol: 'Cadd9',
  rootPc: 0,
  quality: 'maj',
  chordIntervals: [0, 4, 7, 14],
});
const Cmaj7 = resolveAllowed({
  symbol: 'Cmaj7',
  rootPc: 0,
  quality: 'maj',
  chordIntervals: [0, 4, 7, 11],
});
const CslashE = resolveAllowed({
  symbol: 'C/E',
  rootPc: 0,
  quality: 'maj',
  chordIntervals: [0, 4, 7],
  slashBassPc: 4,
});

function notes(pitches: readonly number[], rootPc = 0, intervals: readonly number[] = [0, 4, 7]) {
  return pitches.map((absolutePitch) =>
    compileProductionNote(
      { absolutePitch, durationBeats: 1, velocity: 80 },
      { symbol: '', rootPc, quality: 'maj', chordIntervals: intervals },
    ),
  );
}

function pcs(pitches: readonly (number | null)[]): number[] {
  return pitches.filter((p): p is number => p != null).map((p) => ((p % 12) + 12) % 12);
}

describe('realizeVoiceStructureAttack', () => {
  it('keeps user-chord legality and unique MIDI', () => {
    const got = realizeVoiceStructureAttack(notes([48, 52, 55, 60, 64]), C, emptyVoiceLeadingState());
    const pitches = got.pitches.filter((p): p is number => p != null);
    expect(new Set(pitches).size).toBe(pitches.length);
    for (const p of pitches) expect(C.containsPitch(p)).toBe(true);
  });

  it('allows inversions — bass may be 1, 3, or 5', () => {
    const bassPcs = new Set<number>();
    for (const teacher of [
      [48, 52, 55],
      [52, 55, 60],
      [43, 48, 52],
    ]) {
      const got = realizeVoiceStructureAttack(notes(teacher), C, emptyVoiceLeadingState());
      const pitches = got.pitches.filter((p): p is number => p != null).sort((a, b) => a - b);
      expect(pitches.length).toBe(3);
      bassPcs.add(((pitches[0]! % 12) + 12) % 12);
      expect([0, 4, 7]).toContain(((pitches[0]! % 12) + 12) % 12);
    }
  });

  it('requires slash bass on C/E', () => {
    const got = realizeVoiceStructureAttack(
      notes([48, 52, 55]),
      CslashE,
      emptyVoiceLeadingState(),
      4,
    );
    const pitches = got.pitches.filter((p): p is number => p != null).sort((a, b) => a - b);
    expect(((pitches[0]! % 12) + 12) % 12).toBe(4);
  });

  it('connects C to Am with common tones instead of resetting', () => {
    const c = realizeVoiceStructureAttack(notes([48, 52, 55]), C, emptyVoiceLeadingState());
    const am = realizeVoiceStructureAttack(notes([48, 52, 55]), Am, c.state);
    const cP = c.pitches.filter((p): p is number => p != null);
    const aP = am.pitches.filter((p): p is number => p != null);
    const held = aP.filter((p) => cP.includes(p));
    expect(held.length).toBeGreaterThanOrEqual(2);
    expect(Math.abs((aP[0] ?? 0) - (cP[0] ?? 0))).toBeLessThan(8);
    expect(pcs(aP).every((pc) => Am.containsPc(pc))).toBe(true);
  });

  it('does not park Cadd9 color in the low bass', () => {
    const c = realizeVoiceStructureAttack(notes([48, 52, 55, 60]), C, emptyVoiceLeadingState());
    const add9 = realizeVoiceStructureAttack(notes([48, 52, 55, 62]), Cadd9, c.state);
    const pitches = add9.pitches.filter((p): p is number => p != null).sort((a, b) => a - b);
    const ninths = pitches.filter((p) => p % 12 === 2);
    expect(ninths.length).toBeGreaterThan(0);
    expect(Math.min(...ninths)).toBeGreaterThanOrEqual(50);
    expect(pitches[0]! % 12).not.toBe(2);
  });

  it('keeps Cmaj7 seventh out of the bass and legal', () => {
    const c = realizeVoiceStructureAttack(notes([48, 52, 55, 60]), C, emptyVoiceLeadingState());
    const maj7 = realizeVoiceStructureAttack(notes([48, 52, 55, 59]), Cmaj7, c.state);
    const pitches = maj7.pitches.filter((p): p is number => p != null);
    expect(pitches.some((p) => p % 12 === 11)).toBe(true);
    expect(Math.min(...pitches) % 12).not.toBe(11);
    for (const p of pitches) expect(Cmaj7.containsPitch(p)).toBe(true);
  });

  it('does not clamp a high teacher top to 84', () => {
    const got = realizeVoiceStructureAttack(
      notes([49, 56, 61, 68, 73, 80, 85, 90], 2, [0, 4, 7]),
      resolveAllowed({ symbol: 'D', rootPc: 2, quality: 'maj', chordIntervals: [0, 4, 7] }),
      emptyVoiceLeadingState(),
    );
    const pitches = got.pitches.filter((p): p is number => p != null);
    expect(Math.max(...pitches)).toBeGreaterThan(84);
    expect(pitches.every((p) => p !== 84 || !pitches.some((q) => q > 84))).toBe(true);
  });
});
