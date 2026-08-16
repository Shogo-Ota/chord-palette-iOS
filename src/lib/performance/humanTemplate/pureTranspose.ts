/**
 * Progression-level Pure Transpose for Human MIDI Templates.
 *
 * Identity and Pure Transpose share one formula:
 *   pitch = sourceRootPc + intervalFromRoot + globalDelta
 *
 * globalDelta is one number for the whole progression. It is used only when
 * every loop bar shares the same pitch-class interval. A→C is +3, never -9.
 */

export function wrapPitchClass(n: number): number {
  return ((n % 12) + 12) % 12;
}

/**
 * Single signed semitone shift for a Pure Transpose.
 * Returns undefined when the target is not a uniform transposition of the source.
 */
export function progressionTransposeDelta(
  sourceRoots: readonly number[],
  targetRoots: readonly number[],
): number | undefined {
  if (sourceRoots.length === 0 || sourceRoots.length !== targetRoots.length) {
    return undefined;
  }
  const wrapped = sourceRoots.map((source, i) => wrapPitchClass(targetRoots[i]! - source));
  const pc = wrapped[0]!;
  if (wrapped.some((w) => w !== pc)) return undefined;
  if (pc === 0) return 0;
  if (pc <= 6) return pc;
  return pc - 12;
}

export function reconstructTeacherPitch(sourceRootPc: number, intervalFromRoot: number): number {
  return wrapPitchClass(sourceRootPc) + intervalFromRoot;
}

export function applyGlobalTranspose(
  sourceRootPc: number,
  intervalFromRoot: number,
  globalDelta: number,
): number {
  return reconstructTeacherPitch(sourceRootPc, intervalFromRoot) + globalDelta;
}
