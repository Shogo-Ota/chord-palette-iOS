/**
 * Presentation model for the accompaniment selector.
 *
 * A group is a UI concept, not a persisted/domain accompaniment id. In particular,
 * Variation owns both the historical `arpeggio` takes and the independent City
 * renderer while each keeps its existing storage and playback identity.
 */

import { offeredVariantsFor, type AccompanimentVariantId } from '@/lib/performance/variants';
import type { AccompanimentPattern } from '@/types';

export type AccompanimentGroupId = 'block' | 'natural' | 'variation' | 'arpeggio';

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
const naturalTypes = typesFor('natural');

function presentedNaturalType(
  variant: AccompanimentVariantId,
  label?: string,
): AccompanimentTypeOption | undefined {
  const option = naturalTypes.find((type) => type.variant === variant);
  return option ? { ...option, label: label ?? option.label } : undefined;
}

function definedTypes(
  types: readonly (AccompanimentTypeOption | undefined)[],
): AccompanimentTypeOption[] {
  return types.filter((type): type is AccompanimentTypeOption => type != null);
}

export const PUBLIC_ACCOMPANIMENT_GROUPS: readonly AccompanimentGroup[] = [
  {
    id: 'block',
    label: 'Block',
    types: typesFor('block'),
  },
  {
    id: 'natural',
    label: 'Natural',
    types: definedTypes([
      presentedNaturalType('natural.type1'),
      presentedNaturalType('natural.type2'),
    ]),
  },
  {
    id: 'variation',
    label: 'Variation',
    types: definedTypes([
      city ? { ...city, label: 'City' } : undefined,
      presentedNaturalType('natural.type3', 'Funk'),
      presentedNaturalType('natural.type4', 'Driving'),
      presentedNaturalType('natural.dance1', 'Dance'),
    ]),
  },
  {
    id: 'arpeggio',
    label: 'Arpeggio',
    types: definedTypes([presentedNaturalType('natural.type5', 'Type 1')]),
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
