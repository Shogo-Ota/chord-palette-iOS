/**
 * MIDI integrity (implementation_v1.01 Phase 10 「MIDI整合性」).
 *
 * The engine has no separate Note On / Note Off messages — a `NoteEvent` carries
 * its own duration, so "every Note On has a Note Off" translates to: every event
 * has a finite, strictly positive duration. The remaining invariants map 1:1 to
 * the spec: velocity in 1–127, pitch in the MIDI range, no negative start times,
 * and no event starting after the progression has ended.
 *
 * Every rhythm in the catalog is rendered against all four fixed evaluation
 * progressions (A–D), drums included, exactly the way playback prepares its input
 * (voice leading → remeter → generate).
 */

import { ACCOMPANIMENT_IDS } from '@/data/labels';
import { EVAL_PROGRESSIONS } from '@/lib/performance/analysis/fixtures';
import type { NoteEvent, TrackId } from '@/lib/performance/NoteEvent';
import { generatePerformance, type PerfChord } from '@/lib/performance/PerformanceEngine';
import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import { remeterChords } from '@/lib/performance/meter';
import { beatsPerBarFor } from '@/lib/performance/rhythms';
import { CHORD_CATALOG, pitchClassesFromIntervals } from '@/lib/theory/definitions';
import type { ChordEvent } from '@/types';

const SEED = 42;

const TRACK_IDS: readonly TrackId[] = ['chord', 'top', 'bass', 'kick', 'snare', 'hat'];

function endBeatOf(chords: PerfChord[]): number {
  return chords.reduce((max, c) => Math.max(max, c.startBeat + c.durationBeats), 0);
}

function checkInvariants(notes: NoteEvent[], endBeat: number, label: string): void {
  for (const n of notes) {
    // Note On / Note Off pairing: duration is finite and positive.
    expect(Number.isFinite(n.durationBeat)).toBe(true);
    expect(n.durationBeat).toBeGreaterThan(0);
    // No negative start times; nothing starts after the piece has ended
    // (ringing past the final bar line is musical and allowed).
    expect(Number.isFinite(n.timeBeat)).toBe(true);
    expect(n.timeBeat).toBeGreaterThanOrEqual(0);
    expect(n.timeBeat).toBeLessThan(endBeat);
    // MIDI ranges.
    expect(Number.isInteger(n.velocity)).toBe(true);
    expect(n.velocity).toBeGreaterThanOrEqual(1);
    expect(n.velocity).toBeLessThanOrEqual(127);
    expect(Number.isInteger(n.pitch)).toBe(true);
    expect(n.pitch).toBeGreaterThanOrEqual(0);
    expect(n.pitch).toBeLessThanOrEqual(127);
    // Renderer-facing metadata.
    expect(TRACK_IDS).toContain(n.trackId);
    expect(Number.isInteger(n.rrIndex)).toBe(true);
    expect(n.rrIndex).toBeGreaterThanOrEqual(0);
    if (!Number.isFinite(n.timeBeat)) throw new Error(`invariant context: ${label}`);
  }
}

describe('every rhythm × every fixed progression renders integral MIDI', () => {
  for (const prog of EVAL_PROGRESSIONS) {
    it(`progression ${prog.id} (${prog.name}) holds across all rhythms`, () => {
      const authored = progressionToPerfChords(prog.chords, prog.key);
      for (const pattern of ACCOMPANIMENT_IDS) {
        const chords = remeterChords(authored, beatsPerBarFor(pattern));
        const notes = generatePerformance(
          { chords, bpm: prog.bpm, seed: SEED },
          { styleId: pattern, drums: true },
        );
        expect(notes.length).toBeGreaterThan(0);
        checkInvariants(notes, endBeatOf(chords), `${prog.id}/${pattern}`);
      }
    });
  }
});

describe('every chord quality in the catalog generates without failure', () => {
  function eventFor(defId: string, suffix: string): ChordEvent {
    return {
      id: `integrity-${defId}`,
      chordId: defId,
      displayName: suffix || 'maj',
      degreeLabel: '',
      function: 'tonic',
      durationBeats: 4,
      isPro: false,
      rootOffset: 0,
      suffix,
      definitionId: defId,
    };
  }

  it('renders each definition and only sounds its own pitch classes', () => {
    for (const def of CHORD_CATALOG) {
      const chords = progressionToPerfChords([eventFor(def.id, def.symbol)], 'C');
      const notes = generatePerformance(
        { chords, bpm: 110, seed: SEED },
        { styleId: 'natural', drums: false },
      );
      const pitched = notes.filter((n) => n.trackId === 'chord' || n.trackId === 'top');
      expect(pitched.length).toBeGreaterThan(0);
      checkInvariants(notes, endBeatOf(chords), def.id);

      // Root offset 0 in C ⇒ the chord's pitch classes are its intervals mod 12.
      const allowed = new Set(pitchClassesFromIntervals(def.intervals));
      for (const n of pitched) expect(allowed).toContain(n.pitch % 12);
    }
  });

  it('renders each definition per legacy suffix lookup too (projects without ids)', () => {
    for (const def of CHORD_CATALOG) {
      const legacy: ChordEvent = { ...eventFor(def.id, def.symbol), definitionId: undefined };
      const chords = progressionToPerfChords([legacy], 'C');
      const notes = generatePerformance(
        { chords, bpm: 110, seed: SEED },
        { styleId: 'natural', drums: false },
      );
      expect(notes.length).toBeGreaterThan(0);
    }
  });
});
