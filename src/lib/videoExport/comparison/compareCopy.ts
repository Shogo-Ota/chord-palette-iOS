import type { HarmonyChangeV1 } from '@/lib/comparison';

import type { CompareSceneCopy } from './sceneContracts';

export function buildCompareSceneCopy(changes: readonly HarmonyChangeV1[]): CompareSceneCopy {
  const audible = changes.filter((change) => change.kind !== 'notation-only');
  const hook =
    audible.length === 1 && audible[0]?.variantIndex != null
      ? `${audible[0].variantIndex + 1}つ目を変えると？`
      : '同じ進行から、もう一つの響き';

  return Object.freeze({
    hook,
    baseLabel: '原型',
    variantLabel: '変奏',
    closing: 'どちらを使いたい？',
  });
}
