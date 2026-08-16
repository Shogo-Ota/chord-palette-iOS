/**
 * Release-facing accompaniment availability policy.
 *
 * The engine and catalog keep every historical/internal pattern for saved-data
 * compatibility and QA. Product UI and editor sessions pass through this boundary,
 * so narrowing a release does not delete domain capabilities or scatter checks.
 */

import { defaultVariantFor, offeredVariantsFor, type AccompanimentVariantId } from './variants';
import type { AccompanimentPattern } from '@/types';

export const PUBLIC_ACCOMPANIMENT_PATTERNS = [
  'block',
  'natural',
  'city',
] as const satisfies readonly AccompanimentPattern[];

export type PublicAccompanimentPattern = (typeof PUBLIC_ACCOMPANIMENT_PATTERNS)[number];

export const DEFAULT_PUBLIC_ACCOMPANIMENT: PublicAccompanimentPattern = 'natural';
export const DEFAULT_PUBLIC_VARIANT: AccompanimentVariantId = defaultVariantFor(
  DEFAULT_PUBLIC_ACCOMPANIMENT,
).id;

export type PublicAccompanimentSelection = {
  accompanimentPattern: PublicAccompanimentPattern;
  accompanimentVariant: AccompanimentVariantId;
};

export function normalizePublicAccompanimentSelection(
  pattern: unknown,
  variant: unknown,
): PublicAccompanimentSelection {
  const publicPattern = PUBLIC_ACCOMPANIMENT_PATTERNS.includes(
    pattern as PublicAccompanimentPattern,
  )
    ? (pattern as PublicAccompanimentPattern)
    : DEFAULT_PUBLIC_ACCOMPANIMENT;
  const offered = offeredVariantsFor(publicPattern);
  const selected =
    typeof variant === 'string' ? offered.find((candidate) => candidate.id === variant) : undefined;
  return {
    accompanimentPattern: publicPattern,
    accompanimentVariant: selected?.id ?? defaultVariantFor(publicPattern).id,
  };
}
