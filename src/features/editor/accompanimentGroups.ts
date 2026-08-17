/**
 * Presentation model for the accompaniment selector.
 *
 * A group is a UI concept, not a persisted/domain accompaniment id. In particular,
 * Variation owns both the historical `arpeggio` takes and the independent City
 * renderer while each keeps its existing storage and playback identity.
 */

import { offeredVariantsFor, type AccompanimentVariantId } from '@/lib/performance/variants';
import type { AccompanimentPattern } from '@/types';

export type AccompanimentGroupId = 'block' | 'natural' | 'variation';

export type AccompanimentTypeOption = {
  pattern: AccompanimentPattern;
  variant: AccompanimentVariantId;
  label: string;
  hint: string;
};

export type AccompanimentGroup = {
  id: AccompanimentGroupId;
  label: string;
  types: readonly AccompanimentTypeOption[];
};

function typesFor(pattern: AccompanimentPattern): AccompanimentTypeOption[] {
  return offeredVariantsFor(pattern).map((variant) => ({
    pattern,
    variant: variant.id,
    label: variant.label,
    hint: variant.hint,
  }));
}

const city = typesFor('city')[0];

export const PUBLIC_ACCOMPANIMENT_GROUPS: readonly AccompanimentGroup[] = [
  {
    id: 'block',
    label: 'ブロック',
    types: typesFor('block'),
  },
  {
    id: 'natural',
    label: 'ナチュラル',
    types: typesFor('natural'),
  },
  {
    id: 'variation',
    label: 'バリエーション',
    types: city ? [{ ...city, label: 'City' }] : [],
  },
];

export function groupForSelection(
  pattern: AccompanimentPattern,
  variant: unknown,
): AccompanimentGroup {
  return (
    PUBLIC_ACCOMPANIMENT_GROUPS.find((group) =>
      group.types.some((type) => type.pattern === pattern && type.variant === variant),
    ) ??
    PUBLIC_ACCOMPANIMENT_GROUPS.find((group) =>
      group.types.some((type) => type.pattern === pattern),
    ) ??
    PUBLIC_ACCOMPANIMENT_GROUPS[1]!
  );
}

export function typeForSelection(
  pattern: AccompanimentPattern,
  variant: unknown,
): AccompanimentTypeOption | undefined {
  const group = groupForSelection(pattern, variant);
  return (
    group.types.find((type) => type.pattern === pattern && type.variant === variant) ??
    group.types.find((type) => type.pattern === pattern) ??
    group.types[0]
  );
}
