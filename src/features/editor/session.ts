import { useSyncExternalStore } from 'react';

import { normalizeAccompaniment } from '@/lib/accompaniment';
import { normalizeInstrumentId } from '@/data/labels';
import { DEFAULT_DRUM_BEAT, normalizeDrumBeat, type DrumBeat } from '@/lib/drum/drumBeat';
import {
  DEFAULT_PUBLIC_INSTRUMENT_EFFECT,
  normalizePublicInstrumentEffect,
  type InstrumentEffect,
} from '@/lib/performance/effect';
import { DEFAULT_DRUM_MODE, normalizeDrumMode, type DrumMode } from '@/lib/drum/drumMode';
import {
  DEFAULT_ENERGY,
  normalizeEnergy,
  type AccompanimentEnergy,
} from '@/lib/performance/energy';
import {
  DEFAULT_PUBLIC_ACCOMPANIMENT,
  DEFAULT_PUBLIC_VARIANT,
  normalizePublicAccompanimentSelection,
} from '@/lib/performance/publicAccompaniment';
import { defaultVariantFor, type AccompanimentVariantId } from '@/lib/performance/variants';
import {
  buildV101ListeningChords,
  type ListeningPatternPreset,
  V101_LISTENING_PATTERNS,
} from '@/lib/performance/humanTemplate/listeningProgression';
import { PHASE3C_CASES, type Phase3cCaseId } from '@/lib/playback/phase3cCases';
import { buildPresetProgression } from '@/lib/presets';
import { appendWithinCap, canAdd, canSetDuration } from '@/lib/progression';
import { rebaseProgression, relabelDegreesForKey, transposeProgression } from '@/lib/transpose';
import { createProject, getProject, saveProject } from '@/repositories/projectRepository';
import { DEFAULT_OCTAVE_SHIFT, setLastProjectId } from '@/repositories/sessionPrefsRepository';
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
  /** Sub-variation of the accompaniment; always one the current pattern offers. */
  accompanimentVariant: AccompanimentVariantId;
  /** Style × Energy 「盛り上がり」— independent of Style. Default build. */
  accompanimentEnergy: AccompanimentEnergy;
  /**
   * When true (default), chord-voice notes end at the gate (tight cut).
   * When false, chord/bass/top durations are extended so the piano rings.
   * Device preference — not part of the Project document.
   */
  releaseCut: boolean;
  /**
   * Piano / E.Piano effect — sustain (default) or releaseCut. Supersedes the
   * boolean above, which is kept so anything reading the old flag still works.
   * Device preference — not part of the Project document.
   */
  instrumentEffect: InstrumentEffect;
  /**
   * Whole-arrangement register offset in octaves (device preference, not part of
   * the Project). 0 = original (bass floor C2); 1 = raised one octave (bass floor
   * C3, body in the middle-C comping band). Applied uniformly to playback,
   * preview and export so the bass always stays an octave below the body.
   */
  octaveShift: number;
  /** Device-level drum mode (off / clap / full). Not part of Project. */
  drumMode: DrumMode;
  /** Device-level drum subdivision (4 / 8 / 16 Beat). Not part of Project. */
  drumBeat: DrumBeat;
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
    tempoBpm: 100,
    instrumentId: 'piano',
    grooveId: 'pop8',
    accompanimentPattern: DEFAULT_PUBLIC_ACCOMPANIMENT,
    accompanimentVariant: DEFAULT_PUBLIC_VARIANT,
    accompanimentEnergy: DEFAULT_ENERGY,
    releaseCut: false,
    instrumentEffect: DEFAULT_PUBLIC_INSTRUMENT_EFFECT,
    octaveShift: DEFAULT_OCTAVE_SHIFT,
    drumMode: DEFAULT_DRUM_MODE,
    drumBeat: DEFAULT_DRUM_BEAT,
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

/* ---- editor handoff ----------------------------------------------- */

let seededForEditor = false;

/**
 * Declare that the state was prepared for the editor by the caller (a preset tap,
 * for instance) right before navigating there. The editor screen starts a blank
 * composition only when nothing was handed to it, so a seeded progression cannot
 * be wiped on mount.
 */
export function markSeededForEditor(): void {
  seededForEditor = true;
}

/** Take ownership of a seeded session. False when nothing was handed over. */
export function consumeSeededForEditor(): boolean {
  const seeded = seededForEditor;
  seededForEditor = false;
  return seeded;
}

/* ---- lifecycle ---------------------------------------------------- */

/**
 * Reset to a new, EMPTY composition (blank canvas). The user builds the progression
 * from scratch — no auto-filled starter chords.
 */
export function startNew(): void {
  const { octaveShift, drumMode, drumBeat } = state;
  state = {
    ...initialState(),
    releaseCut: false,
    instrumentEffect: DEFAULT_PUBLIC_INSTRUMENT_EFFECT,
    octaveShift,
    drumMode,
    drumBeat,
    title: 'はじめての進行',
    tempoBpm: 100,
    accompanimentPattern: DEFAULT_PUBLIC_ACCOMPANIMENT,
    accompanimentVariant: DEFAULT_PUBLIC_VARIANT,
    progression: [],
    selected: -1,
    dirty: true,
  };
  emit();
}

function applyProject(p: Project): void {
  const { octaveShift, drumMode, drumBeat } = state;
  const publicAccompaniment = normalizePublicAccompanimentSelection(
    normalizeAccompaniment(p.accompanimentPattern),
    p.accompanimentVariant,
  );
  state = {
    ...initialState(),
    releaseCut: false,
    instrumentEffect: DEFAULT_PUBLIC_INSTRUMENT_EFFECT,
    octaveShift,
    drumMode,
    drumBeat,
    projectId: p.id,
    title: p.title,
    key: p.key,
    tempoBpm: p.tempoBpm,
    instrumentId: normalizeInstrumentId(p.instrumentId),
    grooveId: p.grooveId,
    // Migrate any legacy persisted id (eightBeat/sixteenthBeat) on read.
    accompanimentPattern: publicAccompaniment.accompanimentPattern,
    accompanimentVariant: publicAccompaniment.accompanimentVariant,
    accompanimentEnergy: normalizeEnergy(p.accompanimentEnergy),
    // Respell for the project's own key — a no-op for names, but canonicalizes any
    // legacy slash-chord degree labels ("I/E") to the degree denominator ("I/III").
    // Preserve any saved per-chord keyContext; legacy events fall back to the key.
    progression: transposeProgression(p.chordEvents, p.key).map((e) =>
      e.keyContext ? e : { ...e, keyContext: p.key },
    ),
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
    accompanimentVariant: state.accompanimentVariant,
    accompanimentEnergy: state.accompanimentEnergy,
    chordEvents: state.progression,
    createdAt: state.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}

/** Persist the session (create on first save, update thereafter). */
export async function save(): Promise<void> {
  // Empty title → keep a readable default on the home list.
  if (state.title.trim().length === 0) {
    set({ title: 'はじめての進行' });
  }
  if (state.projectId) {
    const saved = await saveProject(toProject(state.projectId));
    set({ projectId: saved.id, createdAt: saved.createdAt, dirty: false });
    await setLastProjectId(saved.id);
  } else {
    const created = await createProject({
      title: state.title.trim() || 'はじめての進行',
      key: state.key,
      tempoBpm: state.tempoBpm,
      instrumentId: state.instrumentId,
      grooveId: state.grooveId,
      accompanimentPattern: state.accompanimentPattern,
      accompanimentVariant: state.accompanimentVariant,
      accompanimentEnergy: state.accompanimentEnergy,
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

/**
 * Append a chord (built from a library pick). Respects the 16-bar cap.
 * Leaves selection cleared so consecutive library taps keep appending
 * (explicit strip tap is required to enter replace mode).
 */
export function addChord(chord: Omit<ChordEvent, 'id'>): void {
  if (!canAdd(state.progression, chord.durationBeats)) return;
  const next = [...state.progression, { ...chord, id: nextEventId(), keyContext: state.key }];
  commit(next, -1);
}

/**
 * Replace the selected progression chord in place (duration & id kept).
 * Used for live edit: diatonic swap, variation decoration, slash bass, etc.
 */
export function replaceSelected(
  chord: Omit<ChordEvent, 'id' | 'durationBeats'> & { durationBeats?: ChordDuration },
): void {
  if (state.selected < 0) return;
  const cur = state.progression[state.selected];
  if (!cur) return;
  const next = state.progression.map((e, i) =>
    i === state.selected
      ? {
          ...chord,
          id: cur.id,
          durationBeats: chord.durationBeats ?? cur.durationBeats,
          keyContext: state.key,
        }
      : e,
  );
  commit(next, state.selected);
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

/** Clear every chord (history-aware so Undo can restore). */
export function clearProgression(): void {
  if (state.progression.length === 0) return;
  commit([], -1);
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

/** Rename the current project / session (shown on the home list after save). */
export function setTitle(title: string): void {
  const next = title.slice(0, 60);
  if (next === state.title) return;
  set({ title: next, dirty: true });
}

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
  // Moving the whole song lands every chord in one key — collapse any prior
  // multi-key contexts so the arrangement reads as a single key again.
  const progression = transposeProgression(state.progression, key).map((e) => ({
    ...e,
    keyContext: key,
  }));
  set({ key, progression, dirty: true });
}

export function setTempo(bpm: number): void {
  set({ tempoBpm: Math.min(300, Math.max(40, Math.round(bpm))), dirty: true });
}

export function setInstrument(instrumentId: InstrumentId): void {
  set({ instrumentId: normalizeInstrumentId(instrumentId), dirty: true });
}

export function setGroove(grooveId: GrooveId): void {
  set({ grooveId, dirty: true });
}

/**
 * Switch the release-facing accompaniment. Hidden/internal patterns fall back at
 * this boundary so a saved or stale selection cannot keep sounding behind the UI.
 */
export function setAccompaniment(
  accompanimentPattern: AccompanimentPattern,
  variant?: AccompanimentVariantId,
): void {
  const publicAccompaniment = normalizePublicAccompanimentSelection(accompanimentPattern, variant);
  set({
    accompanimentPattern: publicAccompaniment.accompanimentPattern,
    accompanimentVariant: publicAccompaniment.accompanimentVariant,
    dirty: true,
  });
}

export function setAccompanimentVariant(variant: AccompanimentVariantId): void {
  const publicAccompaniment = normalizePublicAccompanimentSelection(
    state.accompanimentPattern,
    variant,
  );
  set({
    accompanimentPattern: publicAccompaniment.accompanimentPattern,
    accompanimentVariant: publicAccompaniment.accompanimentVariant,
    dirty: true,
  });
}

/** Style × Energy — independent of Style; kept across style/instrument changes. */
export function setAccompanimentEnergy(energy: AccompanimentEnergy): void {
  set({ accompanimentEnergy: normalizeEnergy(energy), dirty: true });
}

/**
 * Toggle piano release cut. Device preference — does not mark the project dirty.
 */
export function setReleaseCut(releaseCut: boolean): void {
  const instrumentEffect = normalizePublicInstrumentEffect(releaseCut ? 'releaseCut' : 'sustain');
  if (!state.releaseCut && instrumentEffect === state.instrumentEffect) return;
  set({ releaseCut: false, instrumentEffect });
}

/**
 * Set the piano effect. Device preference — does not mark the project dirty. Keeps the
 * legacy `releaseCut` flag in step so there is only ever one writer of the two.
 */
export function setInstrumentEffect(effect: InstrumentEffect): void {
  const next = normalizePublicInstrumentEffect(effect);
  if (!state.releaseCut && next === state.instrumentEffect) return;
  set({ instrumentEffect: next, releaseCut: false });
}

/**
 * Set the whole-arrangement octave offset. Device preference — does not mark the
 * project dirty (mirrors {@link setReleaseCut}).
 */
export function setOctaveShift(octaveShift: number): void {
  if (octaveShift === state.octaveShift) return;
  set({ octaveShift });
}

/** Device-level drum mode (Groove screen). Does not mark the project dirty. */
export function setDrumMode(drumMode: DrumMode): void {
  const next = normalizeDrumMode(drumMode);
  if (next === state.drumMode) return;
  set({ drumMode: next });
}

/** Device-level drum subdivision (4 / 8 / 16 Beat). Not part of the Project. */
export function setDrumBeat(drumBeat: DrumBeat): void {
  const next = normalizeDrumBeat(drumBeat);
  if (next === state.drumBeat) return;
  set({ drumBeat: next });
}

/* ---- listening lab (v1.01 QA) ------------------------------------ */

let listeningIdCounter = 0;

/** QA: load v1.01 human-template listening progression into the editor session. */
export function loadV101ListeningLab(
  pattern: ListeningPatternPreset = V101_LISTENING_PATTERNS[0]!,
): void {
  const progression = buildV101ListeningChords(
    () => `listen-${Date.now().toString(36)}-${listeningIdCounter++}`,
  ).map((e) => ({ ...e, keyContext: 'C' as const }));

  set({
    projectId: null,
    title: 'v1.01 Listening QA',
    key: 'C',
    tempoBpm: 72,
    instrumentId: 'piano',
    grooveId: pattern.grooveId,
    accompanimentPattern: pattern.accompanimentPattern,
    accompanimentVariant: defaultVariantFor(pattern.accompanimentPattern).id,
    accompanimentEnergy: DEFAULT_ENERGY,
    releaseCut: false,
    instrumentEffect: 'sustain',
    progression,
    history: [],
    selected: 0,
    dirty: true,
  });
}

/** QA: load a Phase 3C A/B case (same Final MIDI for sampled vs sequencer). */
export function loadPhase3cListeningCase(id: Phase3cCaseId): void {
  const c = PHASE3C_CASES[id];
  const progression = c.session.progression.map((e) => ({
    ...e,
    id: `p3c-${Date.now().toString(36)}-${listeningIdCounter++}`,
    keyContext: c.key,
  }));

  set({
    projectId: null,
    title: `Phase 3C ${c.label}`,
    key: c.key,
    tempoBpm: c.session.tempoBpm,
    instrumentId: 'piano',
    grooveId: 'pop8',
    accompanimentPattern: c.session.accompanimentPattern,
    accompanimentVariant: c.session.accompanimentVariant!,
    accompanimentEnergy: DEFAULT_ENERGY,
    releaseCut: true,
    instrumentEffect: 'off',
    octaveShift: 0,
    drumMode: 'off',
    progression,
    history: [],
    selected: 0,
    dirty: true,
  });
}

export { V101_LISTENING_PATTERNS };
export type { ListeningPatternPreset, Phase3cCaseId };

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
    keyContext: targetKey,
  }));
  const { octaveShift, drumMode, drumBeat } = state;
  state = {
    ...initialState(),
    releaseCut: false,
    instrumentEffect: DEFAULT_PUBLIC_INSTRUMENT_EFFECT,
    octaveShift,
    drumMode,
    drumBeat,
    title: preset.name,
    key: targetKey,
    tempoBpm: 100,
    accompanimentPattern: DEFAULT_PUBLIC_ACCOMPANIMENT,
    accompanimentVariant: DEFAULT_PUBLIC_VARIANT,
    progression: events,
    selected: events.length > 0 ? 0 : -1,
    dirty: true,
  };
  markSeededForEditor();
  emit();
}

/* ---- append (recall a stored progression onto the tail) ----------- */

/** Result of an append: how many chords landed vs were dropped at the 16-bar cap. */
export type AppendOutcome = { appended: number; dropped: number };

/** Assign fresh ids, clip to the 16-bar cap, and commit (history-aware / undoable). */
function appendPrepared(incoming: Omit<ChordEvent, 'id'>[]): AppendOutcome {
  // Appended chords are rendered/rebased into the current session key, so they
  // belong to it (appendProject relabels, appendPreset renders in `state.key`).
  const withIds = incoming.map((e) => ({ ...e, id: nextEventId(), keyContext: state.key }));
  const { events, appended, dropped } = appendWithinCap(state.progression, withIds);
  if (appended > 0) commit(events, state.selected < 0 ? state.progression.length : state.selected);
  return { appended, dropped };
}

/**
 * Append a saved project's progression onto the tail at ABSOLUTE pitch: the chords
 * keep their original sound (rebased from the project's key into the current key so
 * voicing stays correct), with degree labels re-read in the current key's context.
 * Respects the 16-bar cap (extra chords are dropped and reported).
 */
export function appendProject(project: Project): AppendOutcome {
  const rebased = rebaseProgression(project.chordEvents, project.key, state.key).map(
    relabelDegreesForKey,
  );
  return appendPrepared(rebased);
}

/**
 * Append a degree-based preset onto the tail, rendered in the current session key
 * (a preset has no absolute pitch of its own). Respects the 16-bar cap.
 */
export function appendPreset(preset: Preset): AppendOutcome {
  return appendPrepared(buildPresetProgression(preset, state.key));
}
