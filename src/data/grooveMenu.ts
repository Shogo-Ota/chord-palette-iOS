import type { GrooveId } from '@/types';

import { GROOVE_LABELS } from './labels';

/**
 * UI grouping layer over {@link GrooveId} (design: groove selector). "8 Beat" and
 * "16 Beat" are presented as a single primary choice each, with a Pop(soft) / Rock(strong)
 * intensity sub-switch that picks the concrete groove id. Soul / Bossa Nova are single
 * grooves with no sub-switch. Pure data — no giant switch, so a new beat family or a new
 * single groove is one array entry, keeping the screen and the domain decoupled.
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

/** Primary groove choices, in selector order. */
export const GROOVE_MENU: readonly GrooveMenuItem[] = [
  { key: 'beat8', label: '8 Beat', variants: { pop: 'pop8', rock: 'rock8' } },
  { key: 'beat16', label: '16 Beat', variants: { pop: 'pop16', rock: 'rock16' } },
  { key: 'soul', label: GROOVE_LABELS.soul16, grooveId: 'soul16' },
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
