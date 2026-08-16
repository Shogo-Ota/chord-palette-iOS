/**
 * Release-facing instrument-effect policy.
 *
 * The domain keeps releaseCut for saved-data compatibility and future QA, while
 * public editor sessions are pinned to the only device-listening-approved effect.
 */
export type PublicInstrumentEffect = 'sustain';

export const DEFAULT_PUBLIC_INSTRUMENT_EFFECT: PublicInstrumentEffect = 'sustain';

export function normalizePublicInstrumentEffect(_effect: unknown): PublicInstrumentEffect {
  return DEFAULT_PUBLIC_INSTRUMENT_EFFECT;
}
