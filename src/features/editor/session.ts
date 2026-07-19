import { useSyncExternalStore } from 'react';

import { PRESETS } from '@/data/presets';
import { buildPresetProgression } from '@/lib/presets';
import { canAdd, canSetDuration } from '@/lib/progression';
import { rebaseProgression, transposeProgression } from '@/lib/transpose';
import {
  createProject,
  getProject,
  saveProject,
} from '@/repositories/projectRepository';
import { setLastProjectId } from '@/repositories/sessionPrefsRepository';
import type {
  AccompanimentPattern,
  ChordDuration,
  ChordEvent,
  GrooveId,
  InstrumentId,
  MajorKey,
  Preset,
  Project,
} from '@/types';

/**
 * Shared editor session — the single source of truth for the composition being
 * edited. The editor screen renders it; the groove and presets screens mutate
 * it; persistence flows through the project repository. Implemented as a tiny
 * external store so any screen can subscribe without prop drilling or fragile
 * navigation-param round-trips.
 */
export type EditorSession = {
  projectId: string | null;
  title: string;
  key: MajorKey;
  tempoBpm: number;
  instrumentId: InstrumentId;
  grooveId: GrooveId;
  accompanimentPattern: AccompanimentPattern;
  progression: ChordEvent[];
  history: ChordEvent[][];
  selected: number;
  dirty: boolean;
  loading: boolean;
  createdAt: number;
};

function initialState(): EditorSession {
  return {
    projectId: null,
    title: '新しい進行',
    key: 'C',
    tempoBpm: 120,
    instrumentId: 'piano',
    grooveId: 'pop8',
    accompanimentPattern: 'block',
    progression: [],
    history: [],
    selected: -1,
    dirty: false,
    loading: false,
    createdAt: 0,
  };
}

let state: EditorSession = initialState();
const listeners = new Set<() => void>();
let counter = 0;

function nextEventId(): string {
  return `ev-${Date.now().toString(36)}-${counter++}`;
}

function emit() {
  for (const l of listeners) l();
}

function set(patch: Partial<EditorSession>) {
  state = { ...state, ...patch };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): EditorSession {
  return state;
}

/** Subscribe a component to the editor session. */
export function useEditorSession(): EditorSession {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Non-reactive read. */
export function getSession(): EditorSession {
  return state;
}

/* ---- lifecycle ---------------------------------------------------- */

/** Free starter progression so new sessions aren't a blank canvas (Phase D). */
function starterProgression(key: MajorKey = 'C'): ChordEvent[] {
  const royal = PRESETS.find((p) => p.id === 'jpop-royal');
  if (!royal) return [];
  return buildPresetProgression(royal, key).map((e, i) => ({
    ...e,
    id: `starter-${i}`,
  }));
}

/**
 * Reset to a new composition with a playable Starter Progression (J-POP 王道).
 * Blank canvas is intentionally avoided (UI refinement §6 retention).
 */
export function startNew(): void {
  const progression = starterProgression('C');
  state = {
    ...initialState(),
    title: 'はじめての進行',
    tempoBpm: 104,
    accompanimentPattern: 'eightBeat',
    progression,
    selected: progression.length > 0 ? 0 : -1,
    dirty: true,
  };
  emit();
}

function applyProject(p: Project): void {
  state = {
    ...initialState(),
    projectId: p.id,
    title: p.title,
    key: p.key,
    tempoBpm: p.tempoBpm,
    instrumentId: p.instrumentId,
    grooveId: p.grooveId,
    accompanimentPattern: p.accompanimentPattern,
    progression: p.chordEvents,
    selected: p.chordEvents.length > 0 ? 0 : -1,
    createdAt: p.createdAt,
  };
  emit();
}

/** Load an existing project from local storage into the session. */
export async function load(id: string): Promise<void> {
  set({ loading: true });
  const project = await getProject(id);
  if (project) applyProject(project);
  else startNew();
  set({ loading: false });
}

function toProject(id: string): Project {
  return {
    id,
    title: state.title,
    key: state.key,
    tempoBpm: state.tempoBpm,
    timeSignature: '4/4',
    instrumentId: state.instrumentId,
    grooveId: state.grooveId,
    accompanimentPattern: state.accompanimentPattern,
    chordEvents: state.progression,
    createdAt: state.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}

/** Persist the session (create on first save, update thereafter). */
export async function save(): Promise<void> {
  if (state.projectId) {
    const saved = await saveProject(toProject(state.projectId));
    set({ projectId: saved.id, createdAt: saved.createdAt, dirty: false });
    await setLastProjectId(saved.id);
  } else {
    const created = await createProject({
      title: state.title,
      key: state.key,
      tempoBpm: state.tempoBpm,
      instrumentId: state.instrumentId,
      grooveId: state.grooveId,
      accompanimentPattern: state.accompanimentPattern,
      chordEvents: state.progression,
    });
    set({ projectId: created.id, createdAt: created.createdAt, dirty: false });
    await setLastProjectId(created.id);
  }
}

/* ---- progression mutations (history-aware) ------------------------ */

function commit(next: ChordEvent[], selected = state.selected): void {
  set({
    history: [...state.history, state.progression],
    progression: next,
    selected,
    dirty: true,
  });
}

export function setSelected(index: number): void {
  set({ selected: index });
}

/** Append a chord (built from a library pick). Respects the 16-bar cap. */
export function addChord(chord: Omit<ChordEvent, 'id'>): void {
  if (!canAdd(state.progression, chord.durationBeats)) return;
  const next = [...state.progression, { ...chord, id: nextEventId() }];
  commit(next, next.length - 1);
}

export function setDuration(beats: ChordDuration): void {
  if (state.selected < 0) return;
  if (!canSetDuration(state.progression, state.selected, beats)) return;
  const next = state.progression.map((e, i) =>
    i === state.selected ? { ...e, durationBeats: beats } : e,
  );
  commit(next);
}

export function duplicateSelected(): void {
  const e = state.progression[state.selected];
  if (!e) return;
  if (!canAdd(state.progression, e.durationBeats)) return;
  const next = [...state.progression];
  next.splice(state.selected + 1, 0, { ...e, id: nextEventId() });
  commit(next, state.selected + 1);
}

export function moveSelected(dir: -1 | 1): void {
  const to = state.selected + dir;
  if (state.selected < 0 || to < 0 || to >= state.progression.length) return;
  const next = [...state.progression];
  [next[state.selected], next[to]] = [next[to], next[state.selected]];
  commit(next, to);
}

export function deleteSelected(): void {
  if (state.selected < 0) return;
  const next = [...state.progression];
  next.splice(state.selected, 1);
  commit(next, Math.min(state.selected, next.length - 1));
}

export function undo(): void {
  if (state.history.length === 0) return;
  const prev = state.history[state.history.length - 1];
  set({
    progression: prev,
    history: state.history.slice(0, -1),
    selected: Math.min(state.selected, prev.length - 1),
    dirty: true,
  });
}

/* ---- settings ----------------------------------------------------- */

/**
 * Change the reference key WITHOUT moving placed chords: each chord keeps its
 * absolute pitch and name; only the diatonic library/scale reference changes.
 */
export function setKey(key: MajorKey): void {
  if (key === state.key) return;
  set({ key, progression: rebaseProgression(state.progression, state.key, key), dirty: true });
}

/** Transpose the whole song to `key` (moves every placed chord). */
export function transposeTo(key: MajorKey): void {
  if (key === state.key) return;
  set({ key, progression: transposeProgression(state.progression, key), dirty: true });
}

export function setTempo(bpm: number): void {
  set({ tempoBpm: Math.min(300, Math.max(40, Math.round(bpm))), dirty: true });
}

export function setInstrument(instrumentId: InstrumentId): void {
  set({ instrumentId, dirty: true });
}

export function setGroove(grooveId: GrooveId): void {
  set({ grooveId, dirty: true });
}

export function setAccompaniment(accompanimentPattern: AccompanimentPattern): void {
  set({ accompanimentPattern, dirty: true });
}

/* ---- presets ------------------------------------------------------ */

/**
 * Start a fresh composition from a preset, auto-transposed to `targetKey`
 * (defaults to the session's current key so presets honor the selected key —
 * requirements §6). The degree-based preset is rendered concretely for the key.
 */
export function startFromPreset(preset: Preset, targetKey: MajorKey = state.key): void {
  const events = buildPresetProgression(preset, targetKey).map((e) => ({
    ...e,
    id: nextEventId(),
  }));
  state = {
    ...initialState(),
    title: preset.name,
    key: targetKey,
    progression: events,
    selected: events.length > 0 ? 0 : -1,
    dirty: true,
  };
  emit();
}
