/**
 * useChordSuggestions — feature hook that surfaces "what sounds good next" for the
 * current editor session. It is a THIN adapter: it reads the shared session
 * (progression + key) and the monetization tier, delegates all musical reasoning to
 * the pure `suggestNext` domain, and bundles a handler that appends a chosen
 * suggestion via the existing `session.addChord` (no new mutation logic here).
 *
 * The UI layer (a "続き候補" chip strip) can bind to this later; keeping the hook free
 * of view logic means the suggestion brain is unit-testable without React and reused
 * unchanged when the UI lands.
 */
import { useCallback, useMemo } from 'react';

import * as session from '@/features/editor/session';
import { useEditorSession } from '@/features/editor/session';
import {
  suggestNext,
  suggestionToChordEvent,
  type ProgressionSuggestion,
} from '@/lib/theory/progression/suggestNext';
import { canAdd } from '@/lib/progression';
import { useTier } from '@/services/billing';
import type { ChordDuration } from '@/types';

export type UseChordSuggestionsOptions = {
  /** Max candidates to surface (default 4). */
  maxResults?: number;
};

export type ChordSuggestions = {
  /** Ranked next-chord candidates for the current progression / key / tier. */
  suggestions: ProgressionSuggestion[];
  /** Append a suggestion to the progression (respects the 16-bar cap). */
  addSuggestion: (s: ProgressionSuggestion, durationBeats?: ChordDuration) => void;
};

export function useChordSuggestions(options: UseChordSuggestionsOptions = {}): ChordSuggestions {
  const s = useEditorSession();
  const tier = useTier();
  const maxResults = options.maxResults ?? 4;

  const suggestions = useMemo(
    () => suggestNext(s.progression, s.key, { allowPro: tier === 'pro', maxResults }),
    [s.progression, s.key, tier, maxResults],
  );

  const addSuggestion = useCallback((sugg: ProgressionSuggestion, durationBeats: ChordDuration = 4) => {
    const event = suggestionToChordEvent(sugg, durationBeats);
    // Guard here too so a full strip visibly stops accepting taps at the 16-bar cap.
    if (!canAdd(session.getSession().progression, event.durationBeats)) return;
    session.addChord(event);
  }, []);

  return { suggestions, addSuggestion };
}
