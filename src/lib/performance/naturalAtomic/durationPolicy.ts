const EPS = 1e-9;

export type NaturalDurationPolicy = {
  chordDurationBeats: number;
  sourceWindowBeats: number;
  timeScale: number;
};

/**
 * Full-bar chords preserve the Teacher timeline exactly. Short chords take an
 * uncompressed prefix instead of squeezing a complete bar into 1–2 beats.
 */
export function naturalDurationPolicy(
  chordDurationBeats: number,
  sourceBarBeats: number,
): NaturalDurationPolicy {
  const safeChordDuration = Math.max(0, chordDurationBeats);
  const safeSourceBar = Math.max(EPS, sourceBarBeats);
  const isShortChord = safeChordDuration < safeSourceBar - EPS;
  return {
    chordDurationBeats: safeChordDuration,
    sourceWindowBeats: isShortChord ? safeChordDuration : safeSourceBar,
    timeScale: isShortChord ? 1 : safeChordDuration / safeSourceBar,
  };
}

/** Returns a chord-relative onset, or null when the source attack is clipped. */
export function mapNaturalSourceOnset(
  sourceOnsetBeat: number,
  policy: NaturalDurationPolicy,
): number | null {
  if (sourceOnsetBeat < -EPS || sourceOnsetBeat >= policy.sourceWindowBeats - EPS) return null;
  const mapped = sourceOnsetBeat * policy.timeScale;
  return mapped < policy.chordDurationBeats - EPS ? mapped : null;
}

/** Scale when necessary and never let a written gate cross the chord boundary. */
export function fitNaturalGate(
  sourceDurationBeat: number,
  mappedOnsetBeat: number,
  policy: NaturalDurationPolicy,
): number {
  const available = Math.max(0, policy.chordDurationBeats - mappedOnsetBeat);
  return Math.min(Math.max(0, sourceDurationBeat * policy.timeScale), available);
}
