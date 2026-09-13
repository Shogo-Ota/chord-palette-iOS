import { isAccompanimentPattern } from '@/lib/accompaniment';
import { normalizeDrumBeat } from '@/lib/drum/drumBeat';
import { normalizeDrumMode } from '@/lib/drum/drumMode';
import type { PerformanceSessionInput } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { instrumentEffectFromReleaseCut, type InstrumentEffect } from '@/lib/performance/effect';
import { beatsPerBarFor } from '@/lib/performance/rhythms';
import { normalizeVariant } from '@/lib/performance/variants';
import { BEATS_PER_BAR, MAX_BARS } from '@/lib/progression';
import type {
  ChordEvent,
  ChordFunction,
  ChordRootSpelling,
  InstrumentId,
  KeyMode,
  MajorKey,
  VoicingPosition,
} from '@/types';

import { fingerprintSnapshot } from './canonicalSnapshot';
import type {
  ComparisonSnapshotSource,
  CreationSnapshotV1,
  ImmutableChordEvent,
  SnapshotFailureReason,
  SnapshotResult,
} from './contracts';

const MAX_EVENTS = MAX_BARS * BEATS_PER_BAR;
const KEYS = new Set<MajorKey>(['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']);
const MODES = new Set<KeyMode>(['major', 'minor']);
const INSTRUMENTS = new Set<InstrumentId>([
  'piano',
  'ePiano',
  'acousticGuitar',
  'electricGuitar',
  'strings',
]);
const FUNCTIONS = new Set<ChordFunction>(['tonic', 'subdominant', 'dominant']);
const EFFECTS = new Set<InstrumentEffect>(['off', 'sustain', 'releaseCut']);
const VOICINGS = new Set<VoicingPosition>(['root', 'first', 'second']);
const DURATIONS = new Set<number>([1, 2, 4]);

function fail(reason: SnapshotFailureReason, detail?: string): SnapshotResult {
  return { ok: false, reason, ...(detail ? { detail } : {}) };
}

function validRootSpelling(value: ChordRootSpelling | undefined): boolean {
  return (
    value == null ||
    (typeof value === 'object' &&
      Number.isSafeInteger(value.degreeIndex) &&
      value.degreeIndex >= 0 &&
      value.degreeIndex <= 6 &&
      (value.alteration === -1 || value.alteration === 0 || value.alteration === 1))
  );
}

function validEvent(event: ChordEvent): boolean {
  return (
    event != null &&
    typeof event === 'object' &&
    typeof event.id === 'string' &&
    event.id.length > 0 &&
    typeof event.chordId === 'string' &&
    event.chordId.length > 0 &&
    typeof event.displayName === 'string' &&
    typeof event.degreeLabel === 'string' &&
    FUNCTIONS.has(event.function) &&
    DURATIONS.has(event.durationBeats) &&
    typeof event.isPro === 'boolean' &&
    Number.isSafeInteger(event.rootOffset) &&
    event.rootOffset >= 0 &&
    event.rootOffset <= 11 &&
    typeof event.suffix === 'string' &&
    (event.definitionId == null || typeof event.definitionId === 'string') &&
    validRootSpelling(event.rootSpelling) &&
    (event.bassOffset == null ||
      (Number.isSafeInteger(event.bassOffset) &&
        event.bassOffset >= 0 &&
        event.bassOffset <= 11)) &&
    (event.keyContext == null || KEYS.has(event.keyContext)) &&
    (event.modeContext == null || MODES.has(event.modeContext)) &&
    (event.voicingPosition == null || VOICINGS.has(event.voicingPosition))
  );
}

function copyEvent(event: ChordEvent): ImmutableChordEvent {
  const rootSpelling = event.rootSpelling ? Object.freeze({ ...event.rootSpelling }) : undefined;
  return Object.freeze({
    ...event,
    ...(rootSpelling ? { rootSpelling } : {}),
  });
}

function validSourceSetting(source: ComparisonSnapshotSource): boolean {
  return (
    KEYS.has(source.key) &&
    MODES.has(source.mode) &&
    INSTRUMENTS.has(source.instrumentId) &&
    isAccompanimentPattern(source.accompanimentPattern) &&
    typeof source.grooveId === 'string' &&
    source.grooveId.length > 0 &&
    (source.accompanimentEnergy === 'verse' ||
      source.accompanimentEnergy === 'build' ||
      source.accompanimentEnergy === 'chorus') &&
    (source.drumMode === 'off' || source.drumMode === 'clap' || source.drumMode === 'full') &&
    (source.drumBeat === '8' || source.drumBeat === '16' || source.drumBeat === '3') &&
    typeof source.releaseCut === 'boolean' &&
    Number.isSafeInteger(source.octaveShift)
  );
}

export function createComparisonSnapshot(source: ComparisonSnapshotSource): SnapshotResult {
  if (
    source.sourceProjectId !== null &&
    (typeof source.sourceProjectId !== 'string' || source.sourceProjectId.length === 0)
  ) {
    return fail('INVALID_PROJECT_ID');
  }
  if (typeof source.title !== 'string' || source.title.length > 60) {
    return fail('INVALID_TITLE');
  }
  if (
    !Number.isFinite(source.tempoBpm) ||
    !Number.isSafeInteger(source.tempoBpm) ||
    source.tempoBpm < 40 ||
    source.tempoBpm > 300
  ) {
    return fail('INVALID_BPM');
  }
  if (!validSourceSetting(source)) return fail('INVALID_SETTING');
  if (!Array.isArray(source.progression)) return fail('INVALID_SETTING');
  if (source.progression.length === 0) return fail('EMPTY_PROGRESSION');
  if (source.progression.length > MAX_EVENTS) return fail('TOO_MANY_EVENTS');

  const ids = new Set<string>();
  for (const event of source.progression) {
    if (!validEvent(event)) return fail('INVALID_EVENT', event.id);
    if (ids.has(event.id)) return fail('DUPLICATE_EVENT_ID', event.id);
    ids.add(event.id);
  }
  const totalAuthoredBeats = source.progression.reduce(
    (sum, event) => sum + event.durationBeats,
    0,
  );
  if (totalAuthoredBeats > MAX_BARS * BEATS_PER_BAR) {
    return fail('TOO_MANY_EVENTS', 'Progression exceeds the current 16-bar cap.');
  }

  const instrumentEffect =
    source.instrumentEffect ?? instrumentEffectFromReleaseCut(source.releaseCut);
  if (!EFFECTS.has(instrumentEffect)) return fail('INVALID_SETTING');

  const progression = Object.freeze(source.progression.map(copyEvent));
  const identity = {
    key: source.key,
    mode: source.mode,
    bpm: source.tempoBpm,
    beatsPerBar: beatsPerBarFor(source.accompanimentPattern),
    progression,
    grooveId: source.grooveId,
    accompanimentPattern: source.accompanimentPattern,
    accompanimentVariant: normalizeVariant(
      source.accompanimentPattern,
      source.accompanimentVariant,
    ),
    accompanimentEnergy: source.accompanimentEnergy,
    instrumentId: source.instrumentId,
    instrumentEffect,
    releaseCut: source.releaseCut,
    octaveShift: source.octaveShift,
    drumMode: normalizeDrumMode(source.drumMode),
    drumBeat: normalizeDrumBeat(source.drumBeat),
  } as const;
  const sourceRevision = fingerprintSnapshot(identity);
  const snapshot: CreationSnapshotV1 = Object.freeze({
    schemaVersion: 1,
    snapshotId: `creation-v1-${sourceRevision}`,
    sourceProjectId: source.sourceProjectId,
    sourceRevision,
    title: source.title,
    ...identity,
  });

  return { ok: true, value: snapshot };
}

export function snapshotToPerformanceInput(snapshot: CreationSnapshotV1): PerformanceSessionInput {
  return {
    key: snapshot.key,
    tempoBpm: snapshot.bpm,
    grooveId: snapshot.grooveId,
    accompanimentPattern: snapshot.accompanimentPattern,
    accompanimentVariant: snapshot.accompanimentVariant,
    instrumentId: snapshot.instrumentId,
    accompanimentEnergy: snapshot.accompanimentEnergy,
    octaveShift: snapshot.octaveShift,
    releaseCut: snapshot.releaseCut,
    instrumentEffect: snapshot.instrumentEffect,
    drumMode: snapshot.drumMode,
    drumBeat: snapshot.drumBeat,
    progression: snapshot.progression.map((event) => ({
      ...event,
      ...(event.rootSpelling ? { rootSpelling: { ...event.rootSpelling } } : {}),
    })),
  };
}
