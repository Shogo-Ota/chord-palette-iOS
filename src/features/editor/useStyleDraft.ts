import { useCallback, useState } from 'react';

import * as session from '@/features/editor/session';
import { getSession, useEditorSession } from '@/features/editor/session';
import {
  defaultVariantFor,
  type AccompanimentVariantId,
} from '@/lib/performance/variants';
import type { AccompanimentPattern, GrooveId, InstrumentId } from '@/types';

/**
 * Uncommitted style edits for the Groove screen. The user auditions the draft
 * locally, then explicitly commits it back to the session (which drives the
 * editor's play button). Keeping the session untouched until commit means the
 * editor reflects only the confirmed style.
 *
 * Scope: project-level style (音色 / ドラム / 伴奏). Device-level prefs
 * (release-cut, volume) stay immediate and are intentionally NOT drafted.
 */
export type StyleDraft = {
  instrumentId: InstrumentId;
  grooveId: GrooveId;
  accompanimentPattern: AccompanimentPattern;
  accompanimentVariant: AccompanimentVariantId;
};

export type UseStyleDraft = {
  draft: StyleDraft;
  /** True when the draft diverges from the committed session style. */
  isDirty: boolean;
  setInstrument: (id: InstrumentId) => void;
  setGroove: (id: GrooveId) => void;
  setAccompaniment: (pattern: AccompanimentPattern) => void;
  setAccompanimentVariant: (id: AccompanimentVariantId) => void;
  /** Write the draft into the shared session (reflects to the editor). */
  commit: () => void;
  /** Drop edits, restoring the draft to the committed session values. */
  reset: () => void;
};

function snapshot(): StyleDraft {
  const cur = getSession();
  return {
    instrumentId: cur.instrumentId,
    grooveId: cur.grooveId,
    accompanimentPattern: cur.accompanimentPattern,
    accompanimentVariant: cur.accompanimentVariant,
  };
}

export function useStyleDraft(): UseStyleDraft {
  const s = useEditorSession();
  const [draft, setDraft] = useState<StyleDraft>(snapshot);

  const setInstrument = useCallback(
    (instrumentId: InstrumentId) => setDraft((d) => ({ ...d, instrumentId })),
    [],
  );
  const setGroove = useCallback(
    (grooveId: GrooveId) => setDraft((d) => ({ ...d, grooveId })),
    [],
  );
  // Switching accompaniment resets the variant: the ids are scoped per pattern, so
  // carrying the old one over would leave the chip row with nothing selected.
  const setAccompaniment = useCallback(
    (accompanimentPattern: AccompanimentPattern) =>
      setDraft((d) => ({
        ...d,
        accompanimentPattern,
        accompanimentVariant: defaultVariantFor(accompanimentPattern).id,
      })),
    [],
  );
  const setAccompanimentVariant = useCallback(
    (accompanimentVariant: AccompanimentVariantId) =>
      setDraft((d) => ({ ...d, accompanimentVariant })),
    [],
  );

  const commit = useCallback(() => {
    session.setInstrument(draft.instrumentId);
    session.setGroove(draft.grooveId);
    session.setAccompaniment(draft.accompanimentPattern, draft.accompanimentVariant);
  }, [draft]);

  const reset = useCallback(() => setDraft(snapshot()), []);

  const isDirty =
    draft.instrumentId !== s.instrumentId ||
    draft.grooveId !== s.grooveId ||
    draft.accompanimentPattern !== s.accompanimentPattern ||
    draft.accompanimentVariant !== s.accompanimentVariant;

  return {
    draft,
    isDirty,
    setInstrument,
    setGroove,
    setAccompaniment,
    setAccompanimentVariant,
    commit,
    reset,
  };
}
