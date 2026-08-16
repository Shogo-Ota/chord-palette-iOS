/**
 * Piano / E.Piano effect — how long a note rings, and nothing else.
 *
 * Product: `sustain` (default) or `releaseCut`. `sustain` lets the written lengths
 * stand and rings through CC64; `releaseCut` closes notes early. `off` is not a user
 * option — it is the identity path for tests, and since gate-01 it produces the same
 * note lengths as `sustain` (they differ only in that a release cut suppresses the
 * pedal). None of these may touch pitch, onset, velocity or the number of notes.
 */

export type InstrumentEffect = 'off' | 'sustain' | 'releaseCut';

/** User-selectable effects. Sustain is the default; the only extra is release cut. */
export const INSTRUMENT_EFFECT_IDS: readonly InstrumentEffect[] = ['sustain', 'releaseCut'];

/** Default: notes ring (sustain). */
export const DEFAULT_INSTRUMENT_EFFECT: InstrumentEffect = 'sustain';

export const INSTRUMENT_EFFECT_LABELS: Record<InstrumentEffect, string> = {
  off: 'サステイン',
  sustain: 'サステイン',
  releaseCut: 'リリースカット',
};

export function normalizeInstrumentEffect(raw: unknown): InstrumentEffect {
  if (raw === 'releaseCut') return 'releaseCut';
  if (raw === 'sustain' || raw === 'off') return 'sustain';
  return DEFAULT_INSTRUMENT_EFFECT;
}

/**
 * Legacy 余韻 flag → product effect. Cut means releaseCut; otherwise sustain.
 * The old "as performed" reading (`off`) is no longer a product state.
 */
export function instrumentEffectFromReleaseCut(releaseCut: boolean): InstrumentEffect {
  return releaseCut ? 'releaseCut' : 'sustain';
}
