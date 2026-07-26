import { UNLIMITED, limitFor, type Entitlements } from '@/lib/entitlements';
import { countFavorites, setFavorite } from '@/repositories/projectRepository';

/** What happened when the player tapped a star. */
export type FavoriteResult =
  | { ok: true; favorited: boolean }
  | { ok: false; reason: 'limit'; limit: number };

/**
 * Star or unstar a project, refusing to go past the tier's ceiling.
 *
 * Unstarring is never refused — a limit that stops you tidying up would be a trap
 * rather than a boundary.
 */
export async function toggleFavorite(
  id: string,
  currentlyFavorited: boolean,
  entitlements: Entitlements,
): Promise<FavoriteResult> {
  if (currentlyFavorited) {
    await setFavorite(id, false);
    return { ok: true, favorited: false };
  }

  const limit = limitFor(entitlements, 'favourites');
  if (limit !== UNLIMITED && (await countFavorites()) >= limit) {
    return { ok: false, reason: 'limit', limit };
  }

  await setFavorite(id, true);
  return { ok: true, favorited: true };
}

/** The message shown when a free player has starred as much as they may. */
export function favoriteLimitMessage(limit: number): string {
  return `無料版のお気に入りは${limit}件までです。Palette Pro で無制限になります`;
}
