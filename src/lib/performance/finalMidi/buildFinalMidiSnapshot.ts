/**
 * Build the canonical Final MIDI Events snapshot from a session performance plan.
 * Pure — no I/O, no native imports.
 */

import type { DrumMode } from '@/lib/drum/drumMode';
import {
  drumBarLengthForGroove,
  drumHitsForGroove,
  gmDrumNote,
  type DrumHit,
} from '@/lib/drum/drumKit';
import type { InstrumentId } from '@/types';
import type { NoteEvent } from '../NoteEvent';
import { pedalCcFromHumanTemplate } from './pedalCcFromTemplate';
import type {
  FinalMidiMarker,
  FinalMidiNote,
  FinalMidiSnapshot,
  SessionPerformancePlan,
} from './types';

const ACCOMP_TRACKS = new Set<NoteEvent['trackId']>(['chord', 'top', 'bass']);

function gmProgramForInstrument(instrumentId: InstrumentId): number {
  switch (instrumentId) {
    case 'ePiano':
      return 4;
    case 'piano':
    default:
      return 0;
  }
}

function timeSignatureFor(beatsPerBar: number): { numerator: number; denominator: number } {
  if (beatsPerBar === 3) return { numerator: 3, denominator: 4 };
  if (beatsPerBar === 6) return { numerator: 6, denominator: 8 };
  return { numerator: 4, denominator: 4 };
}

function perfNotesToFinal(notes: NoteEvent[]): FinalMidiNote[] {
  return notes
    .filter((n) => ACCOMP_TRACKS.has(n.trackId))
    .map((n) => ({
      startBeat: n.timeBeat,
      durationBeat: Math.max(1 / 64, n.durationBeat),
      pitch: n.pitch,
      velocity: n.velocity,
      channel: 0,
      track: 'accompaniment' as const,
    }))
    .sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

function filterDrumHits(hits: DrumHit[], drumMode: DrumMode): DrumHit[] {
  if (drumMode === 'off') return [];
  if (drumMode === 'clap') return hits.filter((h) => h.voice === 'clap');
  return hits;
}

function drumNotesForPlan(plan: SessionPerformancePlan): FinalMidiNote[] {
  const hits = filterDrumHits(drumHitsForGroove(plan.drumPatternId), plan.drumMode);
  if (hits.length === 0) return [];

  const barLen = drumBarLengthForGroove(plan.drumPatternId);
  const barCount = Math.max(1, Math.ceil(plan.totalBeats / barLen));
  const notes: FinalMidiNote[] = [];

  for (let bar = 0; bar < barCount; bar++) {
    const barStart = bar * barLen;
    for (const hit of hits) {
      const startBeat = barStart + hit.beat;
      if (startBeat >= plan.totalBeats - 1e-9) continue;
      const pitch = gmDrumNote(hit.voice);
      const velocity = Math.max(1, Math.min(127, Math.round(hit.vel * 127)));
      notes.push({
        startBeat,
        durationBeat: 0.25,
        pitch,
        velocity,
        channel: 9,
        track: 'drums',
      });
    }
  }

  return notes.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

/**
 * Markers align to the REMETERED chord beats (`plan.chords`), not the authoring-space
 * progression, so a waltz / 6-8 marker sits exactly where its notes are. The chord list
 * is 1:1 with the progression (progressionToPerfChords → remeterChords preserve order).
 */
function markersFromProgression(plan: SessionPerformancePlan): FinalMidiMarker[] {
  return plan.progression.map((chord, i) => ({
    startBeat: plan.chords[i]?.startBeat ?? 0,
    label: chord.displayName,
  }));
}

export function buildFinalMidiSnapshot(plan: SessionPerformancePlan): FinalMidiSnapshot {
  const accompaniment = perfNotesToFinal(plan.notes);
  const drums = drumNotesForPlan(plan);
  // The teacher take's own pedal is the only CC64 written, and it is what `sustain`
  // rings with — note lengths are never stretched to imitate it. A release cut drops
  // the pedal instead: held notes in a DAW would undo the cut the app plays.
  const controlChanges =
    plan.instrumentEffect === 'releaseCut'
      ? []
      : pedalCcFromHumanTemplate(plan.humanTemplateId, plan.chords);

  return {
    bpm: plan.bpm,
    beatsPerBar: plan.beatsPerBar,
    timeSignature: timeSignatureFor(plan.beatsPerBar),
    totalBeats: plan.totalBeats,
    instrumentId: plan.instrumentId,
    gmProgram: gmProgramForInstrument(plan.instrumentId),
    drumMode: plan.drumMode,
    notes: [...accompaniment, ...drums],
    controlChanges,
    markers: markersFromProgression(plan),
  };
}

/** Pitched notes that playback sends to native (same filter as performanceMapper). */
export function playbackAccompanimentNotes(plan: SessionPerformancePlan): FinalMidiNote[] {
  return perfNotesToFinal(plan.notes);
}
