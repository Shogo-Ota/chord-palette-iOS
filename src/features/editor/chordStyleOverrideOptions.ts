import { PUBLIC_ACCOMPANIMENT_GROUPS } from './accompanimentGroups';
import type { ChordAccompanimentOverride } from '@/types';

export type ChordStyleOverrideOption = ChordAccompanimentOverride & {
  id: string;
  displayLabel: string;
  shortLabel: string;
  hint: string;
};

const SHORT_LABELS: Readonly<Record<string, string>> = {
  'block.type1': 'Blk',
  'natural.type1': 'N1',
  'natural.type2': 'N2',
  'city.type1': 'City',
  'natural.type3': 'Funk',
  'natural.type4': 'Drv',
  'natural.dance1': 'Dance',
  'natural.type5': 'Arp',
};

/** UI options derived from the existing public selector; no second availability list. */
export const CHORD_STYLE_OVERRIDE_OPTIONS: readonly ChordStyleOverrideOption[] =
  PUBLIC_ACCOMPANIMENT_GROUPS.flatMap((group) =>
    group.types.map((type) => ({
      id: `${type.pattern}/${type.variant}`,
      pattern: type.pattern,
      variant: type.variant,
      displayLabel: group.id === 'block' ? 'Block' : `${group.label} ${type.label}`,
      shortLabel: SHORT_LABELS[type.variant] ?? type.label,
      hint: type.hint,
    })),
  );

export function chordStyleOverrideOption(
  override: ChordAccompanimentOverride | undefined,
): ChordStyleOverrideOption | undefined {
  if (!override) return undefined;
  return CHORD_STYLE_OVERRIDE_OPTIONS.find(
    (option) => option.pattern === override.pattern && option.variant === override.variant,
  );
}

export function chordStyleOverrideBadge(
  override: ChordAccompanimentOverride | undefined,
): string | undefined {
  const option = chordStyleOverrideOption(override);
  return option?.shortLabel;
}

export function chordStyleOverrideAccessibilityLabel(
  override: ChordAccompanimentOverride | undefined,
): string | undefined {
  const option = chordStyleOverrideOption(override);
  return option ? `個別伴奏スタイル ${option.displayLabel}` : undefined;
}
