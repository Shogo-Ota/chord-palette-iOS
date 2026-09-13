/**
 * Presentation model for the accompaniment selector.
 *
 * A group is a UI concept, not a persisted/domain accompaniment id. In particular,
 * Variation owns both the historical `arpeggio`/Natural takes and the independent City
 * renderer while each keeps its existing storage and playback identity.
 *
 * The groups themselves come from the public STYLE catalog, which is also what names
 * exported files — the screen and the export can therefore never disagree.
 */

import {
  publicStyleFor,
  PUBLIC_STYLE_GROUPS,
  type PublicStyleGroupId,
} from '@/lib/performance/publicStyleCatalog';
import type { AccompanimentVariantId } from '@/lib/performance/variants';
import type { AccompanimentPattern } from '@/types';

export type AccompanimentGroupId = PublicStyleGroupId;

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

export const PUBLIC_ACCOMPANIMENT_GROUPS: readonly AccompanimentGroup[] =
  PUBLIC_STYLE_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    types: group.styles.map((style) => ({
      pattern: style.pattern,
      variant: style.variant,
      label: style.typeLabel,
      hint: style.hint,
    })),
  }));

export function groupForSelection(
  pattern: AccompanimentPattern,
  variant: unknown,
): AccompanimentGroup {
  const style = publicStyleFor(pattern, variant);
  return PUBLIC_ACCOMPANIMENT_GROUPS.find((group) => group.id === style.groupId)!;
}

export function typeForSelection(
  pattern: AccompanimentPattern,
  variant: unknown,
): AccompanimentTypeOption | undefined {
  const style = publicStyleFor(pattern, variant);
  return groupForSelection(pattern, variant).types.find(
    (type) => type.pattern === style.pattern && type.variant === style.variant,
  );
}
