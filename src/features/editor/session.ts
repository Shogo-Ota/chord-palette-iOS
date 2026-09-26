import { useSyncExternalStore } from 'react';

import { normalizeAccompaniment } from '@/lib/accompaniment';
import { normalizeInstrumentId } from '@/data/labels';
import { DEFAULT_DRUM_BEAT, normalizeDrumBeat, type DrumBeat } from '@/lib/drum/drumBeat';
import { isLocked, type Entitlements } from '@/lib/entitlements';
import {
  DEFAULT_PUBLIC_INSTRUMENT_EFFECT,
  normalizePublicInstrumentEffect,
  type InstrumentEffect,
} from '@/lib/performance/effect';
import { DEFAULT_DRUM_MODE, normalizeDrumMode, type DrumMode } from '@/lib/drum/drumMode';
import { DEFAULT_KEY_MODE, normalizeKeyMode } from '@/lib/keyMode';
import {
  DEFAULT_ENERGY,
  normalizeEnergy,
  type AccompanimentEnergy,
} from '@/lib/performance/energy';
import {
  DEFAULT_VOICING_POSITION,
  normalizeVoicingPosition,
  type VoicingPosition,
} from '@/lib/performance/baseVoicing/types';
import {
  DEFAULT_PUBLIC_ACCOMPANIMENT,
  DEFAULT_PUBLIC_VARIANT,
  normalizePublicAccompanimentSelection,
} from '@/lib/performance/publicAccompaniment';
import {
  chordStyleKey,
  normalizeChordStyleOverride,
  normalizeChordStyleOverrides,
  type EffectiveChordStyle,
} from '@/lib/performance/style';
import { defaultVariantFor, type AccompanimentVariantId } from '@/lib/performance/variants';
import {
  buildV101ListeningChords,
  type ListeningPatternPreset,
  V101_LISTENING_PATTERNS,
} from '@/lib/performance/humanTemplate/listeningProgression';
import { PHASE3C_CASES, type Phase3cCaseId } from '@/lib/playback/phase3cCases';
import { buildPresetProgression } from '@/lib/presets';
import { appendWithinCap, canAdd, canSetDuration } from '@/lib/progression';
import { rebaseProgression, relabelDegreesForKey, transposeEvent } from '@/lib/transpose';
import { createProject, getProject, saveProject } from '@/repositories/projectRepository';
import { DEFAULT_OCTAVE_SHIFT, setLastProjectId } from '@/repositories/sessionPrefsRepository';
import type {
  AccompanimentPattern,
  ChordAccompanimentOverride,
  ChordDuration,
  ChordEvent,
  GrooveId,
  InstrumentId,
  KeyMode,
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
  /** How `key` is read. Decides the diatonic library and degree labels, never the pitches. */
  mode: KeyMode;
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
    mode: DEFAULT_KEY_MODE,
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
  const globalStyle: EffectiveChordStyle = {
    pattern: publicAccompaniment.accompanimentPattern,
    variant: publicAccompaniment.accompanimentVariant,
  };
  const progression = normalizeChordStyleOverrides(
    p.chordEvents.map((e) => {
      const eventMode = normalizeKeyMode(e.modeContext ?? p.mode);
      const transposed = transposeEvent(e, p.key, eventMode);
      return {
        ...transposed,
        keyContext: e.keyContext ?? p.key,
        modeContext: eventMode,
        // v1.0.2 stored one Project-wide position. Promote it into every legacy
        // chord exactly once; from here on the event is the production authority.
        voicingPosition: normalizeVoicingPosition(e.voicingPosition ?? p.voicingPosition),
      };
    }),
    globalStyle,
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
    mode: normalizeKeyMode(p.mode),
    tempoBpm: p.tempoBpm,
    instrumentId: normalizeInstrumentId(p.instrumentId),
    grooveId: p.grooveId,
    // Migrate any legacy persisted id (eightBeat/sixteenthBeat) on read.
    accompanimentPattern: publicAccompaniment.accompanimentPattern,
    accompanimentVariant: publicAccompaniment.accompanimentVariant,
    accompanimentEnergy: normalizeEnergy(p.accompanimentEnergy),
    // Respell each chord in the mode it was entered under. A mixed C-major/C-minor
    // project must reload as I–IV–V–I–i–iv–v–i, not be flattened into the last mode.
    progression,
    selected: progression.length > 0 ? 0 : -1,
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
    mode: state.mode,
    tempoBpm: state.tempoBpm,
    timeSignature: '4/4',
    instrumentId: state.instrumentId,
    grooveId: state.grooveId,
    accompanimentPattern: state.accompanimentPattern,
    accompanimentVariant: state.accompanimentVariant,
    accompanimentEnergy: state.accompanimentEnergy,
    // Retained only for backward schema compatibility. Per-chord events are the
    // sole production source of truth after the per-chord migration.
    voicingPosition: DEFAULT_VOICING_POSITION,
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
      mode: state.mode,
      tempoBpm: state.tempoBpm,
      instrumentId: state.instrumentId,
      grooveId: state.grooveId,
      accompanimentPattern: state.accompanimentPattern,
      accompanimentVariant: state.accompanimentVariant,
      accompanimentEnergy: state.accompanimentEnergy,
      voicingPosition: DEFAULT_VOICING_POSITION,
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

/**
 * Replace the complete progression as one history-aware transaction.
 *
 * `expectedCurrent` is an optimistic concurrency guard: callers must prepare
 * against the exact progression reference that is still active. The function
 * performs one `commit()` only, so one call always means one Undo entry.
 */
export function replaceProgressionAtomically(
  expectedCurrent: readonly ChordEvent[],
  next: readonly ChordEvent[],
  selected = state.selected,
): boolean {
  if (state.progression !== expectedCurrent) return false;
  const currentById = new Map(expectedCurrent.map((event) => [event.id, event]));
  const progression = next.map((event) => {
    const source = currentById.get(event.id);
    const { accompanimentOverride: _ignoredOverride, ...replacement } = event;
    return {
      ...replacement,
      ...(event.rootSpelling ? { rootSpelling: { ...event.rootSpelling } } : {}),
      ...(source?.accompanimentOverride
        ? { accompanimentOverride: { ...source.accompanimentOverride } }
        : {}),
    };
  });
  const nextSelected =
    progression.length === 0 ? -1 : Math.min(Math.max(selected, -1), progression.length - 1);
  commit(progression, nextSelected);
  return true;
}

export function setSelected(index: number): void {
  set({ selected: index });
}

/**
 * Append a chord (built from a library pick). Respects the 16-bar cap.
 * Leaves selection cleared so consecutive library taps keep appending
 * (explicit strip tap is required to enter replace mode).
 */
export function addChord(chord: Omit<ChordEvent, 'id' | 'accompanimentOverride'>): void {
  if (!canAdd(state.progression, chord.durationBeats)) return;
  const next = [
    ...state.progression,
    {
      ...chord,
      id: nextEventId(),
      keyContext: state.key,
      modeContext: state.mode,
      voicingPosition: normalizeVoicingPosition(chord.voicingPosition),
    },
  ];
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
  // Replacing harmony must not create or erase a STYLE override. The override belongs
  // to the placed event identity, not to the library chord used as the replacement.
  const { accompanimentOverride: _ignoredOverride, ...replacement } = chord;
  const next = state.progression.map((e, i) =>
    i === state.selected
      ? {
          ...replacement,
          id: cur.id,
          durationBeats: chord.durationBeats ?? cur.durationBeats,
          keyContext: state.key,
          modeContext: state.mode,
          voicingPosition: normalizeVoicingPosition(chord.voicingPosition ?? cur.voicingPosition),
          ...(cur.accompanimentOverride
            ? { accompanimentOverride: { ...cur.accompanimentOverride } }
            : {}),
        }
      : e,
  );
  commit(next, state.selected);
}

/**
 * Decorate the selected chord with a variation.
 *
 * Distinct from {@link replaceSelected} because it is a different act. Replacing answers
 * "make this a different chord"; decorating answers "keep this chord, add a colour to it".
 * `category` records where a chord came from — borrowed, substituted, diatonic — and an `Fm`
 * taken from the parallel minor is still borrowed once it becomes `Fm9`. So the decoration
 * updates the quality and the `variation` id and leaves the origin alone.
 *
 * The variation's own `category` is discarded rather than merged. A variation is not an
 * origin, so it has nothing to say about one, and writing `'variation'` here is what erased
 * the technique in the first place.
 */
export function applyVariationToSelected(
  chord: Omit<ChordEvent, 'id' | 'durationBeats'> & { durationBeats?: ChordDuration },
): void {
  if (state.selected < 0) return;
  const origin = state.progression[state.selected]?.category;
  const { category: _decorationIsNotAnOrigin, ...decoration } = chord;
  replaceSelected(origin ? { ...decoration, category: origin } : decoration);
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

/** Transpose the whole song to `key`, preserving each chord's major/minor section. */
export function transposeTo(key: MajorKey): void {
  if (key === state.key) return;
  const progression = state.progression.map((e) => {
    const eventMode = normalizeKeyMode(e.modeContext ?? state.mode);
    return {
      ...transposeEvent(e, key, eventMode),
      keyContext: key,
      modeContext: eventMode,
    };
  });
  set({ key, progression, dirty: true });
}

/**
 * Choose the mode used by the library and by chords added from this point onward.
 *
 * Existing events keep their `modeContext` and degree label. This makes a mode switch a
 * section boundary: C–F–G–C entered in major remains I–IV–V–I after the user switches to
 * minor and appends Cm–Fm–Gm–Cm as i–iv–v–i.
 */
export function setMode(mode: KeyMode): void {
  const next = normalizeKeyMode(mode);
  if (next === state.mode) return;
  set({ mode: next, dirty: true });
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

/** Set the compact inversion of the selected placed chord only. */
export function setSelectedVoicingPosition(position: VoicingPosition): void {
  if (state.selected < 0) return;
  const current = state.progression[state.selected];
  if (!current) return;
  const next = normalizeVoicingPosition(position);
  if (next === normalizeVoicingPosition(current.voicingPosition)) return;
  commit(
    state.progression.map((event, index) =>
      index === state.selected ? { ...event, voicingPosition: next } : event,
    ),
  );
}

export type AccompanimentOverrideMutationOutcome = {
  updated: boolean;
  blockedBy?: 'palettePro';
  invalidStyle?: true;
};

/**
 * Set or clear the selected chord's single-event STYLE override.
 *
 * Existing saved overrides are grandfathered and therefore never checked merely
 * because another chord operation occurs. This mutation alone owns the Pro gate:
 * setting/changing requires Palette Pro, while `undefined` always removes the
 * override so a lapsed subscriber can return to Global inheritance.
 */
export function setSelectedAccompanimentOverride(
  override: ChordAccompanimentOverride | undefined,
  entitlements: Entitlements,
): AccompanimentOverrideMutationOutcome {
  if (state.selected < 0) return { updated: false };
  const current = state.progression[state.selected];
  if (!current) return { updated: false };

  if (override == null) {
    if (!current.accompanimentOverride) return { updated: false };
    const next = state.progression.map((event, index) => {
      if (index !== state.selected) return event;
      const { accompanimentOverride: _removed, ...inherited } = event;
      return inherited;
    });
    commit(next);
    return { updated: true };
  }

  if (isLocked(true, entitlements)) {
    return { updated: false, blockedBy: 'palettePro' };
  }

  const globalStyle: EffectiveChordStyle = {
    pattern: state.accompanimentPattern,
    variant: state.accompanimentVariant,
  };
  const normalized = normalizeChordStyleOverride(override, globalStyle);
  if (!normalized) return { updated: false, invalidStyle: true };
  if (
    current.accompanimentOverride &&
    chordStyleKey(current.accompanimentOverride) === chordStyleKey(normalized)
  ) {
    return { updated: false };
  }

  commit(
    state.progression.map((event, index) =>
      index === state.selected ? { ...event, accompanimentOverride: { ...normalized } } : event,
    ),
  );
  return { updated: true };
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
  ).map((e) => ({
    ...e,
    keyContext: 'C' as const,
    voicingPosition: DEFAULT_VOICING_POSITION,
  }));

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
    voicingPosition: normalizeVoicingPosition(e.voicingPosition),
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
    // Presets are written in major degrees, so `initialState()` reading below resets to major.
    modeContext: DEFAULT_KEY_MODE,
    voicingPosition: DEFAULT_VOICING_POSITION,
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
  const withIds = incoming.map((e) => ({
    ...e,
    id: nextEventId(),
    keyContext: state.key,
    modeContext: state.mode,
    voicingPosition: normalizeVoicingPosition(e.voicingPosition),
  }));
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
  const sourceStyle = normalizePublicAccompanimentSelection(
    normalizeAccompaniment(project.accompanimentPattern),
    project.accompanimentVariant,
  );
  // Valid saved overrides are grandfathered regardless of current entitlement.
  // Invalid/non-public pairs inherit the source project's Global STYLE instead.
  const inherited = normalizeChordStyleOverrides(project.chordEvents, {
    pattern: sourceStyle.accompanimentPattern,
    variant: sourceStyle.accompanimentVariant,
  });
  const rebased = rebaseProgression(inherited, project.key, state.key).map((e) =>
    relabelDegreesForKey(e, state.mode),
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
