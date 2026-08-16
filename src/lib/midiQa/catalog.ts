/**
 * Production Pattern × Type enumeration — reads the live variant catalog.
 * Adding a Human MIDI Template Type automatically includes it here.
 */

import { CORE_PATTERNS } from '@/lib/performance/model/styleCards';
import { offeredVariantsFor } from '@/lib/performance/variants';
import type { AccompanimentPattern } from '@/types';

export type ProductionSlot = {
  pattern: AccompanimentPattern;
  variantId: string;
};

export function productionSlots(): ProductionSlot[] {
  const slots: ProductionSlot[] = [];
  for (const pattern of CORE_PATTERNS) {
    for (const variant of offeredVariantsFor(pattern)) {
      slots.push({ pattern, variantId: variant.id });
    }
  }
  return slots;
}
