import { foldIntoRange, highlightedKeys, isBlackKey, keyboardLayout } from '@/lib/keyboard';

describe('isBlackKey', () => {
  it('classifies naturals as white and accidentals as black', () => {
    expect(isBlackKey(60)).toBe(false); // C4
    expect(isBlackKey(61)).toBe(true); // C#4
    expect(isBlackKey(64)).toBe(false); // E4
    expect(isBlackKey(66)).toBe(true); // F#4
  });
});

describe('keyboardLayout', () => {
  it('lays out one octave C..C with 8 whites + 5 blacks', () => {
    const layout = keyboardLayout(48, 60, 100);
    const whites = layout.filter((k) => !k.isBlack);
    const blacks = layout.filter((k) => k.isBlack);
    expect(whites).toHaveLength(8); // C D E F G A B C
    expect(blacks).toHaveLength(5);
  });

  it('gives white keys equal width filling the total width', () => {
    const layout = keyboardLayout(48, 60, 100);
    const whites = layout.filter((k) => !k.isBlack);
    const w = whites[0].width;
    expect(w).toBeCloseTo(100 / 8);
    for (const k of whites) expect(k.width).toBeCloseTo(w);
    const last = whites[whites.length - 1];
    expect(last.left + last.width).toBeCloseTo(100);
  });

  it('centers black keys on the boundary between adjacent whites', () => {
    const layout = keyboardLayout(48, 60, 80);
    const whiteW = 80 / 8;
    const cSharp = layout.find((k) => k.midi === 49)!; // between C(48) and D(50)
    expect(cSharp.left + cSharp.width / 2).toBeCloseTo(whiteW);
  });

  it('renders black keys after whites so they draw on top', () => {
    const layout = keyboardLayout(48, 60, 80);
    const firstBlack = layout.findIndex((k) => k.isBlack);
    const lastWhite = layout.map((k) => k.isBlack).lastIndexOf(false);
    expect(firstBlack).toBeGreaterThan(lastWhite);
  });
});

describe('foldIntoRange / highlightedKeys', () => {
  it('folds notes above the range down by octaves (pitch class preserved)', () => {
    expect(foldIntoRange(69, 36, 60)).toBe(57); // A4 → A3
    expect(foldIntoRange(69, 36, 60) % 12).toBe(69 % 12);
  });

  it('folds notes below the range up by octaves', () => {
    expect(foldIntoRange(24, 36, 60)).toBe(36);
  });

  it('leaves in-range notes untouched', () => {
    expect(foldIntoRange(48, 36, 60)).toBe(48);
  });

  it('collapses a chord to its visible highlighted keys', () => {
    const keys = highlightedKeys([48, 52, 55, 71], 36, 60); // Cmaj7 with B4
    expect(keys.has(48)).toBe(true);
    expect(keys.has(59)).toBe(true); // 71 → 59 (B3)
  });
});
