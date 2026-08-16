/**
 * Ranking → pairwise preference rows. No scores involved.
 */

export type RankedItem = { id: string; label: string };

export type PreferencePairRow = {
  progressionId: string;
  preferredId: string;
  rejectedId: string;
  preferredLabel: string;
  rejectedLabel: string;
};

/** B > D > A → BD, BA, DA */
export function pairsFromRanking(
  progressionId: string,
  orderBestFirst: readonly RankedItem[],
): PreferencePairRow[] {
  const pairs: PreferencePairRow[] = [];
  for (let i = 0; i < orderBestFirst.length; i += 1) {
    for (let j = i + 1; j < orderBestFirst.length; j += 1) {
      pairs.push({
        progressionId,
        preferredId: orderBestFirst[i].id,
        rejectedId: orderBestFirst[j].id,
        preferredLabel: orderBestFirst[i].label,
        rejectedLabel: orderBestFirst[j].label,
      });
    }
  }
  return pairs;
}

export function parseRankingLabels(order: string, labelToId: Record<string, string>): RankedItem[] {
  const labels = order
    .split('>')
    .map((s) => s.trim())
    .filter(Boolean);
  return labels.map((label) => {
    const id = labelToId[label];
    if (!id) throw new Error(`unknown ranking label ${label}`);
    return { id, label };
  });
}

export function pairsFromRankingString(
  progressionId: string,
  order: string,
  labelToId: Record<string, string>,
): PreferencePairRow[] {
  return pairsFromRanking(progressionId, parseRankingLabels(order, labelToId));
}
