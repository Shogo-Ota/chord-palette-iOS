import { UNLIMITED, limitFor, type Entitlements } from '@/lib/entitlements';
import { countCappedProjects } from '@/repositories/projectRepository';

/** What the projects screen needs to know before opening a blank editor. */
export interface SaveAllowance {
  /** Projects made since the limit arrived (grandfathered rows excluded). */
  used: number;
  /** The tier's ceiling. `UNLIMITED` when there isn't one. */
  limit: number;
  /** Whether one more may be created right now. */
  canCreate: boolean;
}

/**
 * Pairs the stored count with the tier's ceiling. This is the whole save-limit
 * decision — screens ask it and then either proceed or upsell, so the rule cannot
 * drift between the "new" button, preset loading and duplication.
 */
export async function saveAllowance(entitlements: Entitlements): Promise<SaveAllowance> {
  const limit = limitFor(entitlements, 'projects');
  if (limit === UNLIMITED) return { used: 0, limit, canCreate: true };
  const used = await countCappedProjects();
  return { used, limit, canCreate: used < limit };
}

/** The message shown when a free player has filled their slots. */
export function saveLimitMessage(limit: number): string {
  return `無料版で保存できるのは${limit}件までです。Palette Pro で無制限になります`;
}
