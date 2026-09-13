/**
 * The public STYLE catalog — the single naming authority for what the player picked.
 *
 * A release STYLE is a group (Block / Natural / Variation / Arpeggio) plus the type
 * inside it, and each one points at the `(accompanimentPattern, accompanimentVariant)`
 * pair that plays and generates MIDI. Storage and playback ids stay historical; only
 * this file says how a selection is *named*.
 *
 * Every consumer derives its text from here — the Style screen, the Style summary and
 * the MIDI export file name — so a name can never be maintained twice and drift.
 */

import {
  offeredVariantsFor,
  type AccompanimentVariant,
  type AccompanimentVariantId,
} from './variants';
import type { AccompanimentPattern } from '@/types';

export type PublicStyleGroupId = 'block' | 'natural' | 'variation' | 'arpeggio';

/** One selectable STYLE, named for the player and bound to its playback identity. */
export type PublicStyle = {
  groupId: PublicStyleGroupId;
  groupLabel: string;
  /** Label shown inside the group, e.g. `Type 1`, `City`. */
  typeLabel: string;
  hint: string;
  pattern: AccompanimentPattern;
  variant: AccompanimentVariantId;
};

export type PublicStyleGroup = {
  id: PublicStyleGroupId;
  label: string;
  styles: readonly PublicStyle[];
};

type PublicStyleDefinition = {
  pattern: AccompanimentPattern;
  variant: AccompanimentVariantId;
  /** Public label. Omitted = inherit the variant catalog's own label. */
  label?: string;
};

type PublicStyleGroupDefinition = {
  id: PublicStyleGroupId;
  label: string;
  styles: readonly PublicStyleDefinition[];
};

/**
 * The eight STYLEs a release offers, in screen order. Variation owns both the City
 * renderer and the Natural takes that were promoted into it, which is exactly why the
 * public name cannot be read off the internal pattern or variant id.
 */
const GROUP_DEFINITIONS: readonly PublicStyleGroupDefinition[] = [
  {
    id: 'block',
    label: 'Block',
    styles: [{ pattern: 'block', variant: 'block.type1' }],
  },
  {
    id: 'natural',
    label: 'Natural',
    styles: [
      { pattern: 'natural', variant: 'natural.type1' },
      { pattern: 'natural', variant: 'natural.type2' },
    ],
  },
  {
    id: 'variation',
    label: 'Variation',
    styles: [
      { pattern: 'city', variant: 'city.type1', label: 'City' },
      { pattern: 'natural', variant: 'natural.type3', label: 'Funk' },
      { pattern: 'natural', variant: 'natural.type4', label: 'Driving' },
      { pattern: 'natural', variant: 'natural.dance1', label: 'Dance' },
    ],
  },
  {
    id: 'arpeggio',
    label: 'Arpeggio',
    styles: [{ pattern: 'natural', variant: 'natural.type5', label: 'Type 1' }],
  },
];

function offeredVariant(
  definition: PublicStyleDefinition,
): AccompanimentVariant | undefined {
  return offeredVariantsFor(definition.pattern).find(
    (candidate) => candidate.id === definition.variant,
  );
}

function resolveGroup(definition: PublicStyleGroupDefinition): PublicStyleGroup {
  const styles: PublicStyle[] = [];
  for (const style of definition.styles) {
    const variant = offeredVariant(style);
    if (!variant) continue;
    styles.push({
      groupId: definition.id,
      groupLabel: definition.label,
      typeLabel: style.label ?? variant.label,
      hint: variant.hint,
      pattern: style.pattern,
      variant: variant.id,
    });
  }
  return { id: definition.id, label: definition.label, styles };
}

export const PUBLIC_STYLE_GROUPS: readonly PublicStyleGroup[] =
  GROUP_DEFINITIONS.map(resolveGroup);

export const PUBLIC_STYLES: readonly PublicStyle[] = PUBLIC_STYLE_GROUPS.flatMap(
  (group) => group.styles,
);

/** The STYLE a selection means. Unknown pairs settle on the same default the engine uses. */
export function publicStyleFor(pattern: unknown, variant: unknown): PublicStyle {
  return (
    PUBLIC_STYLES.find((style) => style.pattern === pattern && style.variant === variant) ??
    PUBLIC_STYLES.find((style) => style.pattern === pattern) ??
    PUBLIC_STYLES.find((style) => style.groupId === 'natural')!
  );
}

export function publicStyleGroupFor(pattern: unknown, variant: unknown): PublicStyleGroup {
  const style = publicStyleFor(pattern, variant);
  return PUBLIC_STYLE_GROUPS.find((group) => group.id === style.groupId)!;
}

/**
 * The STYLE segment of an export file name, e.g. `Block`, `Natural-Type1`,
 * `Variation-City`, `Arpeggio`. Derived from the same labels the screen shows, with
 * spaces removed; a group offering a single STYLE needs no type suffix.
 */
export function publicStyleExportLabel(pattern: unknown, variant: unknown): string {
  const style = publicStyleFor(pattern, variant);
  const group = PUBLIC_STYLE_GROUPS.find((candidate) => candidate.id === style.groupId)!;
  const groupToken = compactLabel(style.groupLabel);
  return group.styles.length > 1 ? `${groupToken}-${compactLabel(style.typeLabel)}` : groupToken;
}

function compactLabel(label: string): string {
  return label.replace(/\s+/g, '');
}
