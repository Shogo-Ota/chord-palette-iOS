/**
 * Duration / articulation layer (design §4 "Duration/奏法"): gate 0.72–0.95, with a
 * guaranteed minimum re-strike gap before the same note is hit again (15–35ms), and
 * tie/legato/staccato/ghost assignment.
 *
 * The gate is capped so that the *grid* gap to the next strike is at least
 * {@link RESTRIKE_GAP_MS}; the cap can only reduce the gate toward its floor, so the
 * result always stays inside [gate.min, gate.max].
 */

import type { Articulation, TrackId } from './NoteEvent';
import type { Rng } from './rng';
import type { StylePreset } from './styles/types';

/** Target minimum silence before a note of the same pitch is re-struck (ms). */
export const RESTRIKE_GAP_MS = 20;

/**
 * Resolve a gate (sounding fraction of the nominal length) in [gate.min, gate.max].
 * `nominalMs` is the real-time distance to the next strike of this voice; if a full
 * gate would leave less than {@link RESTRIKE_GAP_MS} of silence, the gate is trimmed
 * (but never below the style floor).
 */
export function computeGate(rng: Rng, style: StylePreset, nominalMs: number): number {
  const { min, max } = style.gate;
  const raw = rng.range(min, max);
  if (nominalMs <= 0) return raw;
  const gapCap = 1 - RESTRIKE_GAP_MS / nominalMs;
  const cap = Math.min(max, Math.max(min, gapCap));
  return Math.min(raw, cap);
}

export interface ArticulationParams {
  track: TrackId;
  style: StylePreset;
  ghost: boolean;
  /** Effective gate resolved by {@link computeGate}. */
  gate: number;
  /** Whether this note holds through to (ties into) the next strike. */
  tie: boolean;
}

/**
 * Pick the articulation label. Ghost hits are `ghost` (incl. ghosted hats); other
 * drums are `normal`; a held note is a `tie`; otherwise short gates read as
 * `staccato`, long gates as the style's sustain articulation (`legato` for Ballad).
 */
export function pickArticulation(p: ArticulationParams): Articulation {
  if (p.ghost) return 'ghost';
  if (p.track === 'kick' || p.track === 'snare' || p.track === 'hat') return 'normal';
  if (p.tie) return 'tie';
  if (p.gate <= 0.76) return 'staccato';
  return p.style.gate.sustain;
}
