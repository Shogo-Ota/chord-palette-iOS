import type { GrooveId } from '@/types';

import { GROOVE_LABELS } from './labels';

/**
 * UI grouping layer over {@link GrooveId} (design: groove selector). Every current
 * choice is a single primary button (no sub-switch): "8 Beat" (Pop & Rock read the
 * same, so they collapse to `pop8`), "16 Beat" (`soul16`), "Clap", "Bossa Nova".
 * The Pop/Rock variant machinery below is retained so a future beat family can opt
 * back into an intensity sub-switch without reworking the selector. Pure data — no
 * giant switch, so a new groove is one array entry, keeping UI and domain decoupled.
 */
export type GrooveVariant = 'pop' | 'rock';

export interface GrooveMenuItem {
  /** Stable key for the primary button (not a GrooveId when it has variants). */
  readonly key: string;
  /** Primary button label, e.g. "8 Beat". */
  readonly label: string;
  /** Present ⇒ this family has a Pop/Rock intensity switch. */
  readonly variants?: Readonly<Record<GrooveVariant, GrooveId>>;
  /** Present ⇒ this is a single groove with no sub-switch. */
  readonly grooveId?: GrooveId;
}

export const GROOVE_VARIANT_LABELS: Readonly<Record<GrooveVariant, string>> = {
  pop: 'Pop',
  rock: 'Rock',
};

export const GROOVE_VARIANTS: readonly GrooveVariant[] = ['pop', 'rock'];

/**
 * Primary groove choices, in selector order.
 *
 * "8 Beat" collapsed its Pop/Rock split into `pop8` — the two intensities read the
 * same in practice, so it is now a single choice. "16 Beat" and "Soul" were likewise
 * consolidated: "16 Beat" maps to the Soul groove (`soul16`) and the standalone
 * "Soul" entry is gone. "Clap" is a single groove (kick + backbeat with a hand-clap
 * accent on the 3rd beat). No item carries a sub-switch anymore.
 */
export const GROOVE_MENU: readonly GrooveMenuItem[] = [
  { key: 'beat8', label: '8 Beat', grooveId: 'pop8' },
  { key: 'beat16', label: '16 Beat', grooveId: 'soul16' },
  { key: 'clap', label: GROOVE_LABELS.clap, grooveId: 'clap' },
  { key: 'bossaNova', label: GROOVE_LABELS.bossaNova, grooveId: 'bossaNova' },
];

/** The primary menu item + (for beat families) the Pop/Rock variant a groove maps to. */
export interface GrooveMenuState {
  readonly itemKey: string;
  readonly variant?: GrooveVariant;
}

/** Resolve the menu state a concrete groove id represents (unknown ⇒ first item / pop). */
export function menuStateForGroove(grooveId: GrooveId): GrooveMenuState {
  for (const item of GROOVE_MENU) {
    if (item.grooveId === grooveId) return { itemKey: item.key };
    if (item.variants) {
      for (const v of GROOVE_VARIANTS) {
        if (item.variants[v] === grooveId) return { itemKey: item.key, variant: v };
      }
    }
  }
  return { itemKey: GROOVE_MENU[0].key, variant: 'pop' };
}

/** Find a menu item by its key. */
export function menuItem(key: string): GrooveMenuItem | undefined {
  return GROOVE_MENU.find((i) => i.key === key);
}

/**
 * The concrete groove a primary button should select, preserving the current
 * Pop/Rock choice when tapping between beat families.
 */
export function grooveForItem(item: GrooveMenuItem, variant: GrooveVariant): GrooveId {
  if (item.grooveId) return item.grooveId;
  return item.variants ? item.variants[variant] : 'pop8';
}
