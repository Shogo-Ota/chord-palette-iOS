import type { FinalMidiSnapshot } from '@/lib/performance/finalMidi/types';

import type { GrooveCandidate } from './types';

export function grooveCandidateToSnapshot(candidate: GrooveCandidate): FinalMidiSnapshot {
  return {
    bpm: candidate.bpm,
    beatsPerBar: 4,
    timeSignature: { numerator: 4, denominator: 4 },
    totalBeats: candidate.totalBeats,
    instrumentId: 'piano',
    gmProgram: 0,
    drumMode: 'off',
    notes: candidate.notes.map((note) => ({
      startBeat: note.startBeat,
      durationBeat: note.durationBeat,
      pitch: note.pitch,
      velocity: note.velocity,
      channel: 0,
      track: 'accompaniment',
    })),
    controlChanges: candidate.controlChanges,
    markers: Array.from({ length: 8 }, (_, barIndex) => ({
      startBeat: barIndex * 4,
      label: candidate.chordSymbols[barIndex % candidate.chordSymbols.length],
    })),
  };
}
