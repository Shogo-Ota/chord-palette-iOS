/**
 * useAutosave — debounced updates for projects already added to Memory.
 *
 * A new session remains local until the user presses the editor Save icon. Once
 * `projectId` exists, edits keep the existing debounce so saved work is protected.
 *
 * The debounce itself is a PURE, React-free `createAutosaveScheduler` so it can
 * be unit tested with fake timers, while the hook is a thin lifecycle wrapper.
 */
import { useEffect, useRef } from 'react';

import * as session from '@/features/editor/session';
import { useEditorSession } from '@/features/editor/session';
import { logger } from '@/lib/logger';

/** Default debounce window (ms) — matches the pre-extraction inline behavior. */
export const AUTOSAVE_DEBOUNCE_MS = 700;

type TimerApi = {
  set: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clear: (handle: ReturnType<typeof setTimeout>) => void;
};

const defaultTimers: TimerApi = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle),
};

export type AutosaveScheduler = {
  /** (Re)arm the debounce. A falsy `dirty` cancels any pending save. */
  schedule: (dirty: boolean) => void;
  /** Cancel a pending save without firing it. */
  cancel: () => void;
};

/** New sessions must not create a Memory row without an explicit Save-icon action. */
export function shouldAutosave(projectId: string | null, dirty: boolean): boolean {
  return projectId !== null && dirty;
}

/**
 * Pure debounce scheduler: each `schedule(true)` restarts the timer; the save
 * fires once the window elapses without another change. `schedule(false)` (i.e.
 * nothing dirty) cancels. Injecting `timers` keeps it deterministic under tests.
 */
export function createAutosaveScheduler(
  save: () => void,
  debounceMs: number = AUTOSAVE_DEBOUNCE_MS,
  timers: TimerApi = defaultTimers,
): AutosaveScheduler {
  let handle: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (handle !== null) {
      timers.clear(handle);
      handle = null;
    }
  };

  const schedule = (dirty: boolean) => {
    cancel();
    if (!dirty) return;
    handle = timers.set(() => {
      handle = null;
      save();
    }, debounceMs);
  };

  return { schedule, cancel };
}

/**
 * Auto-update a saved editor session whenever it becomes dirty, debounced.
 * Unsaved sessions stay in memory until the explicit Save icon calls `session.save()`.
 */
export function useAutosave(debounceMs: number = AUTOSAVE_DEBOUNCE_MS): void {
  const s = useEditorSession();
  const schedulerRef = useRef<AutosaveScheduler | null>(null);

  if (schedulerRef.current === null) {
    schedulerRef.current = createAutosaveScheduler(() => {
      session.save().catch((e) => logger.error('Auto-save failed', { error: String(e) }));
    }, debounceMs);
  }

  useEffect(() => {
    const scheduler = schedulerRef.current!;
    scheduler.schedule(shouldAutosave(s.projectId, s.dirty));
    return () => scheduler.cancel();
    // Re-arm on any persisted field change so edits within the window keep
    // pushing the save out (same deps set as the previous inline effect).
  }, [
    s.projectId,
    s.dirty,
    s.progression,
    s.key,
    s.tempoBpm,
    s.title,
    s.grooveId,
    s.instrumentId,
    s.accompanimentPattern,
  ]);
}
