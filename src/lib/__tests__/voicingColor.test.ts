import { progressionToChordSpecs } from '@/lib/voicing';
import { refineBodyVoicing } from '@/lib/voicingColor';
import type { ChordEvent } from '@/types';

/** Minimal ChordEvent for the playback voicing path (only degree fields matter). */
function ev(rootOffset: number, suffix: string): ChordEvent {
  return {
    id: 'x',
    chordId: 'x',
    displayName: 'x',
    degreeLabel: 'x',
    function: 'tonic',
    durationBeats: 4,
    isPro: false,
    rootOffset,
    suffix,
  } as ChordEvent;
}

const pc = (n: number) => ((n % 12) + 12) % 12;
const bodyOf = (spec: { midiNotes: number[] }) => spec.midiNotes.filter((n) => n >= 48);

/* ------------------------------------------------------------------ */
/* refineBodyVoicing — rootless + open voicing                         */
/* ------------------------------------------------------------------ */
describe('refineBodyVoicing — rootless (bass owns the root)', () => {
  it('drops the root from a triad → 2-note shell', () => {
    expect(refineBodyVoicing([48, 52, 55], 0)).toEqual([52, 55]); // C E G → E G
  });

  it('drops the root from an add9 → 3-note body (user-chosen color kept)', () => {
    expect(refineBodyVoicing([48, 52, 55, 62], 0)).toEqual([52, 55, 62]); // C E G D → E G D
  });

  it('never reduces the body below two notes', () => {
    expect(refineBodyVoicing([52, 55], 0)).toEqual([52, 55]); // already a shell → kept
  });

  it('does not mutate its input', () => {
    const input = [48, 52, 55];
    refineBodyVoicing(input, 0);
    expect(input).toEqual([48, 52, 55]);
  });
});

describe('refineBodyVoicing — open voicing (thin the 5th when dense)', () => {
  it('a 5-note 9th chord drops the 5th and the root', () => {
    // C9 = C E G B♭ D → drop G (5th) then C (root) → E B♭ D.
    expect(refineBodyVoicing([48, 52, 55, 58, 62], 0)).toEqual([52, 58, 62]);
  });

  it('leaves a 4-note body’s 5th intact (only thins ≥5-note stacks)', () => {
    // Cmaj7 = C E G B → rootless only → E G B (5th kept).
    expect(refineBodyVoicing([48, 52, 55, 59], 0)).toEqual([52, 55, 59]);
  });
});

/* ------------------------------------------------------------------ */
/* Integration — playback matches the chosen chord name (no auto color) */
/* ------------------------------------------------------------------ */
describe('progressionToChordSpecs — plays the user’s chosen quality only', () => {
  it('a plain I triad stays a triad (no auto 9th / maj7)', () => {
    const [spec] = progressionToChordSpecs([ev(0, '')], 'C');
    const pcs = new Set(bodyOf(spec).map(pc));
    // Rootless body of C: E + G only (root lives in the bass).
    expect([...pcs].sort((a, b) => a - b)).toEqual([4, 7]);
    expect(pcs.has(2)).toBe(false); // no D (9th)
    expect(pcs.has(11)).toBe(false); // no B (maj7)
  });

  it('a plain vi triad stays minor triad tones (no auto m(add9))', () => {
    const [spec] = progressionToChordSpecs([ev(9, 'm')], 'C');
    const pcs = new Set(bodyOf(spec).map(pc));
    // Am rootless: C + E (A in bass).
    expect([...pcs].sort((a, b) => a - b)).toEqual([0, 4]);
    expect(pcs.has(2)).toBe(false); // no B (9th of Am)
  });

  it('an explicit add9 keeps its 9th; an explicit maj7 keeps its maj7', () => {
    const [add9] = progressionToChordSpecs([ev(0, 'add9')], 'C');
    const [maj7] = progressionToChordSpecs([ev(0, 'maj7')], 'C');
    expect(bodyOf(add9).map(pc)).toContain(2); // D
    expect(bodyOf(maj7).map(pc)).toContain(11); // B
  });
});
