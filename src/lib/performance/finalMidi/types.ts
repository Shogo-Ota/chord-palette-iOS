/**
 * Final MIDI Events — canonical representation shared by audio playback mapping
 * and Standard MIDI File export. Built from Performance Engine output (after
 * release cut); never contains teacher-template source pitches.
 */

import type { InstrumentEffect } from '../effect';
import type { HarmonyViolation } from '../harmonyGate';
import type { NoteEvent } from '../NoteEvent';
import type { PerfChord } from '../PerformanceEngine';
import type { DrumMode } from '@/lib/drum/drumMode';
import type { ChordEvent, InstrumentId } from '@/types';

/** One resolved note destined for playback or SMF export. */
export type FinalMidiNote = {
  startBeat: number;
  durationBeat: number;
  pitch: number;
  velocity: number;
  /** 0 = accompaniment voice; 9 = GM drums (channel 10). */
  channel: number;
  track: 'accompaniment' | 'drums';
};

/** Control change on the accompaniment channel (e.g. sustain CC64). */
export type FinalMidiControlChange = {
  startBeat: number;
  controller: number;
  value: number;
  channel: number;
};

/** Chord label at a progression boundary (for DAW comparison). */
export type FinalMidiMarker = {
  startBeat: number;
  label: string;
};

export type FinalMidiSnapshot = {
  bpm: number;
  beatsPerBar: number;
  timeSignature: { numerator: number; denominator: number };
  totalBeats: number;
  instrumentId: InstrumentId;
  /** GM program number written to the accompaniment track. */
  gmProgram: number;
  drumMode: DrumMode;
  notes: FinalMidiNote[];
  controlChanges: FinalMidiControlChange[];
  markers: FinalMidiMarker[];
};

/** Inputs produced once from the editor session — shared by playback and export. */
export type SessionPerformancePlan = {
  notes: NoteEvent[];
  chords: PerfChord[];
  progression: ChordEvent[];
  bpm: number;
  totalBeats: number;
  beatsPerBar: number;
  drumPatternId: string;
  instrumentId: InstrumentId;
  drumMode: DrumMode;
  /** The piano effect already applied to `notes` — export reads it for the pedal. */
  instrumentEffect: InstrumentEffect;
  humanTemplateId?: string;
  seed: number;
  /** Illegal pitches detected after generation. Never repaired by the gate. */
  harmonyViolations?: HarmonyViolation[];
};

export type FinalMidiValidationResult = {
  ok: boolean;
  errors: string[];
};
