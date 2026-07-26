/**
 * How good the exported clip is allowed to be.
 *
 * Two inputs meet here: the tier's ceiling from the entitlement policy, and
 * whether this install predates that ceiling. Installs that were already
 * exporting at 1080p keep doing so — a cap introduced in an update should shape
 * what is offered next, not quietly downgrade what someone already had.
 *
 * The legacy flag is read once and cached in a tiny external store (same shape as
 * `features/admin/adminMode`) so the export screen can answer synchronously and
 * its preview never disagrees with what gets encoded.
 */

import { useSyncExternalStore } from 'react';

import { can, limitFor, type Entitlements } from '@/lib/entitlements';
import { PRO_POLICY } from '@/lib/entitlements/policy';
import { getLegacyExportQuality } from '@/repositories/sessionPrefsRepository';

let legacy = false;
let loaded = false;
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): boolean {
  return legacy;
}

/** Hydrate from persistence once (safe to call on every screen mount). */
export async function loadLegacyExportQuality(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const stored = await getLegacyExportQuality();
  if (stored !== legacy) {
    legacy = stored;
    for (const l of listeners) l();
  }
}

/** What this device may produce right now. */
export interface ExportQuality {
  /** Long edge of the 9:16 frame. */
  height: number;
  /** Whether the clip carries the Chord Palette mark. */
  watermark: boolean;
}

function resolve(entitlements: Entitlements, grandfathered: boolean): ExportQuality {
  return {
    height: grandfathered
      ? Math.max(limitFor(entitlements, 'videoHeight'), PRO_POLICY.limits.videoHeight)
      : limitFor(entitlements, 'videoHeight'),
    watermark: !can(entitlements, 'export.noWatermark'),
  };
}

/** Reactive read for the export screen. */
export function useExportQuality(entitlements: Entitlements): ExportQuality {
  const grandfathered = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return resolve(entitlements, grandfathered);
}
