/**
 * Piano accompaniment register policy.
 *
 * Preferred range is C2–G4 — the band that stays full on a phone speaker without
 * thinning into the high treble. Each voice has its own preferred zone inside
 * that band. The hard limit is wider (G1–C5) so a leap or a de-mud bump can
 * escape the preferred window without jumping to C6/C7.
 *
 * This is a placement policy only. Pitch-class membership stays with AllowedToneSet.
 */

export type VoicePart = 'bass' | 'inner' | 'top';

export type RegisterWindow = {
  lo: number;
  hi: number;
  center: number;
};

export type VoiceRegister = {
  preferred: RegisterWindow;
  hard: RegisterWindow;
};

/** Ensemble preferred band: C2–G4. */
export const PREFERRED_RANGE: RegisterWindow = { lo: 36, hi: 67, center: 52 };

/** Ensemble hard band: G1–C5. Wider than preferred, still below the thin treble. */
export const HARD_RANGE: RegisterWindow = { lo: 31, hi: 72, center: 52 };

export const VOICE_REGISTERS: Record<VoicePart, VoiceRegister> = {
  bass: {
    preferred: { lo: 36, hi: 48, center: 43 },
    hard: { lo: 31, hi: 52, center: 43 },
  },
  inner: {
    preferred: { lo: 43, hi: 64, center: 55 },
    hard: { lo: 36, hi: 67, center: 55 },
  },
  top: {
    preferred: { lo: 60, hi: 67, center: 64 },
    hard: { lo: 55, hi: 72, center: 64 },
  },
};

export type RegisterNoteHint = {
  voicingPosition?: string;
  registerHint?: string;
  chordRole?: string;
};

/**
 * Map a template note onto a voice part. Position wins; hint and role break ties
 * so a lowest-root stays in the bass even when the hint says mid.
 */
export function voicePartFor(note: RegisterNoteHint): VoicePart {
  const pos = note.voicingPosition ?? '';
  const hint = note.registerHint ?? '';
  const role = note.chordRole ?? '';

  if (pos === 'lowest' || (pos === '' && (hint === 'low' || role === 'root'))) {
    return 'bass';
  }
  if (pos === 'top' || hint === 'high') return 'top';
  return 'inner';
}

export function voiceRegisterFor(note: RegisterNoteHint): VoiceRegister {
  return VOICE_REGISTERS[voicePartFor(note)];
}

/** Nearest in-range instance of `pc` to `center`. */
export function foldPcToWindow(pc: number, window: RegisterWindow): number {
  const classPc = ((pc % 12) + 12) % 12;
  let best = window.center;
  let bestDist = Infinity;
  for (let p = window.lo; p <= window.hi; p++) {
    if (p % 12 !== classPc) continue;
    const d = Math.abs(p - window.center);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

/** Octave-fold into the hard window. Last-resort safety, not a voicing choice. */
export function clampToHardLimit(pitch: number): number {
  let p = Math.round(pitch);
  while (p < HARD_RANGE.lo) p += 12;
  while (p > HARD_RANGE.hi) p -= 12;
  return Math.max(HARD_RANGE.lo, Math.min(HARD_RANGE.hi, p));
}

export function isInside(pitch: number, window: RegisterWindow): boolean {
  return pitch >= window.lo && pitch <= window.hi;
}

/** Soft cost: 0 inside preferred, growing toward the hard edge, large beyond hard. */
export function registerCost(pitch: number, note: RegisterNoteHint): number {
  const { preferred, hard } = voiceRegisterFor(note);
  if (isInside(pitch, preferred)) return 0;
  if (isInside(pitch, hard)) {
    const over =
      pitch < preferred.lo ? preferred.lo - pitch : pitch - preferred.hi;
    return over / 6;
  }
  const over = pitch < hard.lo ? hard.lo - pitch : pitch - hard.hi;
  return 4 + over / 3;
}
