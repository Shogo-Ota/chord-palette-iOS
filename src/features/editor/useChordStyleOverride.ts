import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  setSelected,
  setSelectedAccompanimentOverride,
  type AccompanimentOverrideMutationOutcome,
  type EditorSession,
} from './session';
import type { Entitlements } from '@/lib/entitlements';
import type { ChordAccompanimentOverride } from '@/types';

export type ChordStyleOverrideDependencies = {
  setSelected: typeof setSelected;
  setOverride: typeof setSelectedAccompanimentOverride;
};

const DEFAULT_DEPENDENCIES: ChordStyleOverrideDependencies = {
  setSelected,
  setOverride: setSelectedAccompanimentOverride,
};

export type UseChordStyleOverrideOptions = {
  session: EditorSession;
  entitlements: Entitlements;
  onOpenPaywall: () => void;
  dependencies?: ChordStyleOverrideDependencies;
};

/**
 * UI flow for one selected ChordEvent.
 *
 * The hook keeps only an event id as the paywall return intent. Entitlement changes
 * reopen the picker and restore selection, but never apply a STYLE automatically.
 * All access decisions still happen at the Session mutation boundary.
 */
export function useChordStyleOverride({
  session,
  entitlements,
  onOpenPaywall,
  dependencies = DEFAULT_DEPENDENCIES,
}: UseChordStyleOverrideOptions) {
  const [visible, setVisible] = useState(false);
  const [targetEventId, setTargetEventId] = useState<string | null>(null);
  const [awaitingEntitlement, setAwaitingEntitlement] = useState(false);

  const targetIndex = useMemo(
    () =>
      targetEventId == null
        ? -1
        : session.progression.findIndex((event) => event.id === targetEventId),
    [session.progression, targetEventId],
  );
  const targetEvent = targetIndex >= 0 ? session.progression[targetIndex] : undefined;

  useEffect(() => {
    if (targetEventId == null) return;
    if (targetIndex < 0) {
      setVisible(false);
      setAwaitingEntitlement(false);
      setTargetEventId(null);
      return;
    }
    if (!awaitingEntitlement || !entitlements.palettePro) return;
    dependencies.setSelected(targetIndex);
    setAwaitingEntitlement(false);
    setVisible(true);
  }, [awaitingEntitlement, dependencies, entitlements.palettePro, targetEventId, targetIndex]);

  const open = useCallback(() => {
    const event = session.progression[session.selected];
    if (!event) return;
    setTargetEventId(event.id);
    if (entitlements.palettePro || event.accompanimentOverride) {
      setAwaitingEntitlement(false);
      setVisible(true);
      return;
    }
    setAwaitingEntitlement(true);
    setVisible(false);
    onOpenPaywall();
  }, [entitlements.palettePro, onOpenPaywall, session.progression, session.selected]);

  const close = useCallback(() => {
    setVisible(false);
    if (!awaitingEntitlement) setTargetEventId(null);
  }, [awaitingEntitlement]);

  const select = useCallback(
    (override: ChordAccompanimentOverride | undefined): AccompanimentOverrideMutationOutcome => {
      if (targetIndex < 0) return { updated: false };
      dependencies.setSelected(targetIndex);
      const outcome = dependencies.setOverride(override, entitlements);
      if (outcome.blockedBy === 'palettePro') {
        setVisible(false);
        setAwaitingEntitlement(true);
        onOpenPaywall();
        return outcome;
      }
      setVisible(false);
      setAwaitingEntitlement(false);
      setTargetEventId(null);
      return outcome;
    },
    [dependencies, entitlements, onOpenPaywall, targetIndex],
  );

  return {
    visible,
    awaitingEntitlement,
    targetEvent,
    open,
    close,
    select,
  };
}
