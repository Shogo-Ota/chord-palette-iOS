/**
 * Whole-catalog guards for the thirteen rhythms.
 *
 * These stand in for the parts of the device pass that are arithmetic rather than
 * taste: that every rhythm is audibly its own thing, that the grid does not move
 * when the tempo does, and that a re-struck pitch is never buried under the note
 * before it (the shape that leaves a key hanging).
 */

import { ACCOMPANIMENT_IDS } from '@/data/labels';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import { generatePerformance, type PerfChord } from '@/lib/performance/PerformanceEngine';
import { remeterChords } from '@/lib/performance/meter';
import { beatsPerBarFor } from '@/lib/performance/rhythms';
import type { AccompanimentPattern } from '@/types';

/** Four bars of I–V–vi–IV in authoring (4/4) beats. */
function authored(): PerfChord[] {
  return [60, 67, 69, 65].map((root, bar) => ({
    bodyMidi: [root, root + 4, root + 7],
    bassMidi: [root - 24],
    arpMidi: [root, root + 4, root + 7, root + 11],
    startBeat: bar * 4,
    durationBeats: 4,
  }));
}

/** Render the way playback does: remeter into the rhythm's bar, then generate. */
function render(pattern: AccompanimentPattern, bpm: number): NoteEvent[] {
  return generatePerformance(
    { chords: remeterChords(authored(), beatsPerBarFor(pattern)), bpm, seed: 7 },
    { styleId: pattern, drums: false },
  );
}

function ordered(notes: NoteEvent[]): NoteEvent[] {
  return [...notes].sort((a, b) => a.timeBeat - b.timeBeat || a.pitch - b.pitch);
}

const TEMPOS = [60, 120, 180];

describe('every rhythm is its own thing', () => {
  it('no two rhythms render the same take', () => {
    const seen = new Map<string, string>();
    for (const pattern of ACCOMPANIMENT_IDS) {
      const sig = ordered(render(pattern, 120))
        .map((n) => `${n.trackId}@${n.timeBeat.toFixed(4)}:${n.pitch}:${n.durationBeat.toFixed(4)}`)
        .join('|');
      expect(seen.get(sig)).toBeUndefined();
      seen.set(sig, pattern);
    }
  });
});

describe('the grid survives the tempo', () => {
  // Humanize and swing are applied in milliseconds, so they occupy a different
  // fraction of a beat at each tempo — that is the point of them. What must not
  // move is the grid underneath: the same notes, on the same beats.
  const CHOOSES_BY_TEMPO: readonly string[] = ['driving'];

  it('plays the same number of notes at 60, 120 and 180', () => {
    const fixed = ACCOMPANIMENT_IDS.filter((id) => !CHOOSES_BY_TEMPO.includes(id));
    for (const pattern of fixed) {
      const counts = TEMPOS.map((bpm) => render(pattern, bpm).length);
      expect(new Set(counts).size).toBe(1);
    }
  });

  it('still lets Driving pick a denser skeleton when the tempo asks for one', () => {
    expect(render('driving', 180).length).toBeGreaterThan(render('driving', 60).length);
  });

  it('holds each note within a tenth of a beat of where it sits at 120', () => {
    const fixed = ACCOMPANIMENT_IDS.filter((id) => !CHOOSES_BY_TEMPO.includes(id));
    for (const pattern of fixed) {
      const reference = ordered(render(pattern, 120));
      for (const bpm of TEMPOS) {
        ordered(render(pattern, bpm)).forEach((n, i) => {
          expect(Math.abs(n.timeBeat - reference[i].timeBeat)).toBeLessThan(0.1);
        });
      }
    }
  });

  it('keeps every note inside the piece with a positive length', () => {
    for (const pattern of ACCOMPANIMENT_IDS) {
      const end = 4 * beatsPerBarFor(pattern); // four bars, in this rhythm's beats
      for (const bpm of TEMPOS) {
        for (const n of render(pattern, bpm)) {
          expect(n.timeBeat).toBeGreaterThanOrEqual(-1e-9);
          expect(n.durationBeat).toBeGreaterThan(0);
          // Ringing past the final bar line is musical; starting after the piece
          // has ended is not.
          expect(n.timeBeat).toBeLessThan(end);
        }
      }
    }
  });
});

describe('a re-struck pitch is never buried', () => {
  /** Longest time a note keeps sounding past the next strike of its own pitch. */
  function worstOverlap(pattern: AccompanimentPattern): { beats: number; buries: number } {
    let beats = 0;
    let buries = 0;
    for (const bpm of TEMPOS) {
      const byVoice = new Map<string, NoteEvent[]>();
      for (const n of render(pattern, bpm)) {
        const k = `${n.trackId}:${n.pitch}`;
        byVoice.set(k, [...(byVoice.get(k) ?? []), n]);
      }
      for (const notes of byVoice.values()) {
        const line = ordered(notes);
        line.forEach((n, i) => {
          if (i === 0) return;
          const prev = line[i - 1];
          const end = prev.timeBeat + prev.durationBeat;
          beats = Math.max(beats, end - n.timeBeat);
          buries = Math.max(buries, line.filter((m, j) => j >= i && end > m.timeBeat + 1e-9).length);
        });
      }
    }
    return { beats, buries };
  }

  it('never lets a note outlast two strikes of its own pitch', () => {
    // One strike of overlap is legato. Two means the middle strike is inaudible
    // and its note-off may cut the one after it.
    for (const pattern of ACCOMPANIMENT_IDS) {
      expect(worstOverlap(pattern).buries).toBeLessThanOrEqual(1);
    }
  });

  it('only the swung rhythms overlap at all, and only slightly', () => {
    // Swing shifts the off-beat late but the gate is still measured on the straight
    // grid (`durationBeat = nominalBeat * gate`), so a swung chord tail crosses the
    // next downbeat by roughly the swing delay. It reads as a thicker attack rather
    // than a glitch, so it is pinned rather than papered over — see release-plan.md.
    const overlapping = ACCOMPANIMENT_IDS.filter((id) => worstOverlap(id).beats > 1 / 64);
    expect(overlapping).toEqual(['shuffle', 'swing']);
    for (const id of overlapping) expect(worstOverlap(id).beats).toBeLessThan(0.2);
  });
});
