import type { GroovePreferencePair, GrooveProgression } from './types';

export function groovePairsFromRanking(
  progressionId: GrooveProgression['id'],
  ranking: string,
  labelToId: Record<string, string>,
): GroovePreferencePair[] {
  const labels = ranking
    .split('>')
    .map((label) => label.trim())
    .filter(Boolean);
  if (new Set(labels).size !== labels.length) {
    throw new Error(`${progressionId}: duplicate ranking label`);
  }
  const pairs: GroovePreferencePair[] = [];
  for (let i = 0; i < labels.length; i += 1) {
    const preferredId = labelToId[labels[i]];
    if (!preferredId) throw new Error(`${progressionId}: unknown label ${labels[i]}`);
    for (let j = i + 1; j < labels.length; j += 1) {
      const rejectedId = labelToId[labels[j]];
      if (!rejectedId) throw new Error(`${progressionId}: unknown label ${labels[j]}`);
      pairs.push({
        progressionId,
        preferredId,
        rejectedId,
        preferredLabel: labels[i],
        rejectedLabel: labels[j],
      });
    }
  }
  return pairs;
}
