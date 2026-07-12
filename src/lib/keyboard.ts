/**
 * Piano keyboard geometry (pure, UI-independent). Turns a MIDI range into laid-out
 * white/black key rectangles so the export visual (and later the native video
 * renderer) can draw an identical keyboard and highlight the notes of the current
 * chord. Kept free of React so it stays unit-testable.
 */

/** Pitch classes (0 = C) that are white keys; the rest are black. */
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function isBlackKey(midi: number): boolean {
  return !WHITE_PCS.includes(pitchClass(midi));
}

export type KeyRect = {
  midi: number;
  isBlack: boolean;
  /** Left edge in px within `totalWidth`. */
  left: number;
  /** Key width in px. */
  width: number;
};

/**
 * Lay out every key from `low`..`high` (inclusive) across `totalWidth`. White keys
 * are equal-width columns; black keys are narrower and centered on the boundary
 * between the two white keys they sit between. Black keys come last so callers can
 * render them on top.
 */
export function keyboardLayout(
  low: number,
  high: number,
  totalWidth: number,
  blackWidthRatio = 0.62,
): KeyRect[] {
  const whitePos: Record<number, number> = {};
  const whites: KeyRect[] = [];
  const blacks: KeyRect[] = [];

  let whiteCount = 0;
  for (let m = low; m <= high; m++) {
    if (!isBlackKey(m)) whiteCount++;
  }
  const whiteWidth = whiteCount > 0 ? totalWidth / whiteCount : totalWidth;
  const blackWidth = whiteWidth * blackWidthRatio;

  let whiteIndex = 0;
  for (let m = low; m <= high; m++) {
    if (!isBlackKey(m)) {
      const left = whiteIndex * whiteWidth;
      whitePos[m] = left;
      whites.push({ midi: m, isBlack: false, left, width: whiteWidth });
      whiteIndex++;
    }
  }

  for (let m = low; m <= high; m++) {
    if (isBlackKey(m)) {
      // The white key immediately below a black key always exists (pcs 1,3,6,8,10
      // sit above 0,2,5,7,9), so its right edge is the boundary to center on.
      const leftWhite = whitePos[m - 1];
      if (leftWhite == null) continue;
      const boundary = leftWhite + whiteWidth;
      blacks.push({ midi: m, isBlack: true, left: boundary - blackWidth / 2, width: blackWidth });
    }
  }

  return [...whites, ...blacks];
}

/**
 * Fold a MIDI note into the visible `[low, high]` range by octaves so it always
 * lands on a drawn key (the pitch class — hence the note name — is preserved).
 */
export function foldIntoRange(midi: number, low: number, high: number): number {
  let n = midi;
  while (n < low) n += 12;
  while (n > high) n -= 12;
  return n;
}

/** Set of visible MIDI keys to highlight for the given chord notes. */
export function highlightedKeys(notes: number[], low: number, high: number): Set<number> {
  return new Set(notes.map((n) => foldIntoRange(n, low, high)));
}
