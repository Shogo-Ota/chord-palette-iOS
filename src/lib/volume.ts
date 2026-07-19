/**
 * Pure volume / slider math (Phase 2). UI-independent and fully unit-testable —
 * no React Native / Expo imports so the domain layer can convert between the
 * canonical linear volume (0.0–1.0) and the slider's integer percent (0–100),
 * and translate a touch coordinate on the track into a percent.
 */

/** Clamp and round an arbitrary number into an integer percent in [0, 100]. */
export function clampPercent(percent: number): number {
  if (Number.isNaN(percent)) return 0;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

/**
 * Convert a horizontal touch position (px, relative to the track's left edge)
 * on a track of `width` px into an integer percent [0, 100]. A non-positive
 * width (not measured yet) yields 0 so callers never emit NaN.
 */
export function positionToPercent(x: number, width: number): number {
  if (!(width > 0)) return 0;
  return clampPercent((x / width) * 100);
}

/** Canonical linear volume (0.0–1.0) → integer percent [0, 100]. */
export function volumeToPercent(volume: number): number {
  return clampPercent(volume * 100);
}

/** Percent [0, 100] → canonical linear volume (0.0–1.0). */
export function percentToVolume(percent: number): number {
  return clampPercent(percent) / 100;
}
