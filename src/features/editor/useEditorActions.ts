/**
 * useEditorActions — the editor's `visibleActions` view-model (sprint-7 §3 / §6).
 *
 * Design contract (docs/design/ios-uiux-refinement.md §5):
 *   - VISIBLE = READY / UNAVAILABLE = HIDE·TRANSFORM / LOADING ≠ DEAD.
 *   - The ViewModel returns which Actions to show and each one's state; the View
 *     renders declaratively and must NOT re-derive visibility inline.
 *   - ActionState is the 3-value union `'hidden' | 'ready' | 'loading'`.
 *     Unimplemented Actions are HIDDEN via Feature Flag, never `disabled`.
 *
 * This module is deliberately split into PURE functions (`computeVisibleActions`,
 * `computeChordContext`) that take plain state — so the visibility logic is unit
 * testable without React — plus a thin hook that reads the shared session store
 * and bundles the chord-context handlers (which only delegate to `session.*`,
 * leaving the Data Model / business logic unchanged).
 */
import { useCallback, useMemo } from 'react';

import { featureFlags, type FeatureFlags } from '@/config/featureFlags';
import * as session from '@/features/editor/session';
import { useEditorSession, type EditorSession } from '@/features/editor/session';
import { canAdd } from '@/lib/progression';
import type { PlaybackState } from '@/services/audio/types';
import type { ChordDuration } from '@/types';

/** The 3 legal states for any shown Action (§5). */
export type ActionState = 'hidden' | 'ready' | 'loading';

/**
 * How the single Play/Pause CTA should behave/appear:
 *   - `'empty'`  → progression is empty; transform to "最初のコードを選ぶ" (no dead-end).
 *   - `'pause'`  → currently playing; the CTA pauses.
 *   - `'play'`   → stopped/paused; the CTA starts/resumes.
 */
export type PlayMode = 'empty' | 'play' | 'pause';

export type VisibleActions = {
  /** Undo: ready only when there is history to pop, else hidden. */
  undo: { state: ActionState };
  /** Loop: ready only with 2+ chords, else hidden. */
  loop: { state: ActionState };
  /** Play/Pause: always present (the one Filled CTA); `mode` drives its shape. */
  play: { state: ActionState; mode: PlayMode };
  /** Metronome: hidden unless the feature flag is on (unimplemented → hidden). */
  metronome: { state: ActionState };
};

/**
 * Capability + visibility of the selected-chord operations. The Long Press
 * Context Menu (@designer) renders these; @generator only computes can-do flags
 * and bundles the existing `session.*` mutations as handlers.
 */
export type ChordContextActions = {
  /** Whether a chord is currently selected (the menu should exist at all). */
  visible: boolean;
  canDuplicate: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  canDelete: boolean;
  canEditDuration: boolean;
};

/* ------------------------------------------------------------------ */
/* Pure logic (React-free, unit-testable)                              */
/* ------------------------------------------------------------------ */

/** Session fields the visibility logic depends on. */
export type VisibleActionsInput = Pick<EditorSession, 'progression' | 'history'>;

/** Derive the visible Actions + their states from session + transport + flags. */
export function computeVisibleActions(
  input: VisibleActionsInput,
  playbackState: PlaybackState,
  flags: Pick<FeatureFlags, 'metronome'> = featureFlags,
): VisibleActions {
  const length = input.progression.length;
  const isPlaying = playbackState === 'playing';
  const isPreparing = playbackState === 'preparing';

  const mode: PlayMode = length === 0 ? 'empty' : isPlaying ? 'pause' : 'play';

  return {
    undo: { state: input.history.length > 0 ? 'ready' : 'hidden' },
    loop: { state: length >= 2 ? 'ready' : 'hidden' },
    play: { state: isPreparing ? 'loading' : 'ready', mode },
    metronome: { state: flags.metronome ? 'ready' : 'hidden' },
  };
}

/** Session fields the chord-context logic depends on. */
export type ChordContextInput = Pick<EditorSession, 'progression' | 'selected'>;

/** Derive per-selection capability flags for the chord Context Menu. */
export function computeChordContext(input: ChordContextInput): ChordContextActions {
  const { progression, selected } = input;
  const visible = selected >= 0 && selected < progression.length;
  const event = visible ? progression[selected] : undefined;
  return {
    visible,
    canDuplicate: !!event && canAdd(progression, event.durationBeats),
    canMoveLeft: visible && selected > 0,
    canMoveRight: visible && selected < progression.length - 1,
    canDelete: visible,
    canEditDuration: visible,
  };
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export type UseEditorActionsOptions = {
  /** Current transport state (owned by the screen's audio listeners). */
  playbackState: PlaybackState;
  /**
   * Called when Play is pressed on an EMPTY progression. The View wires this to
   * "open the chord picker" so the empty-Play button transforms instead of
   * dead-ending (§5 UNAVAILABLE = TRANSFORM).
   */
  onRequestFirstChord?: () => void;
  /** Called when Play should actually toggle playback (non-empty progression). */
  onTogglePlayback?: () => void;
};

export type EditorActions = {
  visibleActions: VisibleActions;
  chordContext: ChordContextActions;
  /** Play handler honoring the empty→transform contract. */
  onPlayPause: () => void;
  /* Chord-context handlers — thin delegates to the shared session (no new logic). */
  duplicateSelected: () => void;
  moveSelectedLeft: () => void;
  moveSelectedRight: () => void;
  deleteSelected: () => void;
  setDuration: (beats: ChordDuration) => void;
};

/**
 * View-model hook: reads the shared editor session, computes `visibleActions`
 * and chord-context capabilities, and exposes the bundled handlers the View
 * binds to. All mutations delegate to `session.*` — the Data Model is untouched.
 */
export function useEditorActions(options: UseEditorActionsOptions): EditorActions {
  const s = useEditorSession();
  const { playbackState, onRequestFirstChord, onTogglePlayback } = options;

  const visibleActions = useMemo(
    () => computeVisibleActions(s, playbackState),
    [s, playbackState],
  );

  const chordContext = useMemo(() => computeChordContext(s), [s]);

  const onPlayPause = useCallback(() => {
    if (visibleActions.play.mode === 'empty') onRequestFirstChord?.();
    else onTogglePlayback?.();
  }, [visibleActions.play.mode, onRequestFirstChord, onTogglePlayback]);

  const moveSelectedLeft = useCallback(() => session.moveSelected(-1), []);
  const moveSelectedRight = useCallback(() => session.moveSelected(1), []);
  const setDuration = useCallback((beats: ChordDuration) => session.setDuration(beats), []);

  return {
    visibleActions,
    chordContext,
    onPlayPause,
    duplicateSelected: session.duplicateSelected,
    moveSelectedLeft,
    moveSelectedRight,
    deleteSelected: session.deleteSelected,
    setDuration,
  };
}
