/**
 * Deterministic humanize helpers — mirrors AudioEngineController.swift so
 * Preview and Export can stay bit-identical once native consumes this module.
 */

/** Velocity/gain jitter in [0,1]. Same seed → same result. */
export function humanizeGain(base: number, seed: number, amount = 0.07): number {
  if (amount <= 0) return clamp01(base);
  const h = Math.sin(seed * 12.9898) * 43758.5453;
  const frac = h - Math.floor(h);
  const jitter = (frac * 2 - 1) * amount;
  return clamp01(base * (1 + jitter));
}

/** Micro timing sway in beats (±amount). */
export function timingSway(seed: number, amountBeats: number): number {
  if (amountBeats <= 0) return 0;
  const h = Math.sin(seed * 7.1321) * 43758.5453;
  const frac = h - Math.floor(h);
  return (frac * 2 - 1) * amountBeats;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
