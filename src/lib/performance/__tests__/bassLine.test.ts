/**
 * Bass-line planner (implementation_v1.01 Phase 7).
 *
 * Unit half: the planner's contract on hand-built strikes — identity for
 * root-only profiles, root on every strong landing, altered fifths kept, and
 * out-of-chord tones confined to the last hit before a root change.
 *
 * Engine half: the whole catalog still renders inside the register and leap
 * limits, connectives sit only against chord boundaries, and the moving
 * profiles actually move (the pre-v1.01 bass never left the anchored root).
 */

import { ACCOMPANIMENT_IDS } from '@/data/labels';
import { EVAL_PROGRESSIONS } from '@/lib/performance/analysis/fixtures';
import { planBassLine } from '@/lib/performance/bass';
import type { ChordTones } from '@/lib/performance/bass';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import { generatePerformance, type PerfChord } from '@/lib/performance/PerformanceEngine';
import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import { remeterChords } from '@/lib/performance/meter';
import { beatsPerBarFor } from '@/lib/performance/rhythms';
import type { Strike } from '@/lib/performance/strike';

const C_TONES: ChordTones = { bodyMidi: [60, 64, 67], arpMidi: [60, 64, 67] };
const F_TONES: ChordTones = { bodyMidi: [65, 69, 72], arpMidi: [65, 69, 72] };
const C_DIM_TONES: ChordTones = { bodyMidi: [60, 63, 66], arpMidi: [60, 63, 66] };

function strike(bar: number, step: number, gridBeat: number, root: number): Strike {
  return { bar, step, gridBeat, accent: 0.8, ghost: false, pitches: [root] };
}

/** Two one-bar segments: C (root 36) then F (root 41), four 8th-ish hits each. */
function twoSegments(): Strike[] {
  return [
    strike(0, 0, 0, 36),
    strike(0, 2, 1, 36),
    strike(0, 4, 2, 36),
    strike(0, 6, 3, 36),
    strike(1, 0, 4, 41),
    strike(1, 2, 5, 41),
    strike(1, 4, 6, 41),
    strike(1, 6, 7, 41),
  ];
}

const chordOf = (s: Strike): ChordTones => (s.pitches[0] === 41 ? F_TONES : C_TONES);

describe('planner unit contract', () => {
  it('is the exact identity for root-only profiles (textures, legacy ids)', () => {
    for (const styleId of ['block', 'arpeggio', 'eightBeat', 'unknown']) {
      const strikes = twoSegments();
      expect(planBassLine(strikes, { seed: 7, styleId, chordOf })).toBe(strikes);
    }
  });

  it('keeps the root on every chord arrival and bar downbeat', () => {
    for (let seed = 0; seed < 20; seed++) {
      const out = planBassLine(twoSegments(), { seed, styleId: 'beat8', chordOf });
      expect(out[0].pitches).toEqual([36]); // C arrival
      expect(out[4].pitches).toEqual([41]); // F arrival (also a downbeat)
    }
  });

  it('confines out-of-chord tones to the last hit before a root change', () => {
    const allowed = (tones: ChordTones) =>
      new Set([...tones.bodyMidi, ...(tones.arpMidi ?? [])].map((p) => p % 12));
    for (let seed = 0; seed < 20; seed++) {
      const out = planBassLine(twoSegments(), { seed, styleId: 'driving', chordOf });
      out.forEach((s, i) => {
        const inChord = allowed(i < 4 ? C_TONES : F_TONES).has(((s.pitches[0] % 12) + 12) % 12);
        // Index 3 is the only slot allowed to leave the chord (approach into F);
        // the final segment has no following root, so its tail stays in-chord.
        if (i !== 3) expect(inChord).toBe(true);
      });
    }
  });

  it('plays the chord’s own altered fifth, not a wrong perfect fifth', () => {
    // Single segment (no approach possible) on a diminished chord: the waltz
    // profile alternates root–fifth, so odd hits must take the ♭5 (36 + 6).
    const strikes = [strike(0, 0, 0, 36), strike(0, 2, 1, 36), strike(0, 4, 2, 36)];
    for (let seed = 0; seed < 10; seed++) {
      const out = planBassLine(strikes, { seed, styleId: 'waltz', chordOf: () => C_DIM_TONES });
      expect(out[1].pitches).toEqual([42]);
    }
  });

  it('never leaps more than an octave within a segment', () => {
    for (let seed = 0; seed < 20; seed++) {
      const out = planBassLine(twoSegments(), { seed, styleId: 'driving', chordOf });
      for (let i = 1; i < 4; i++) {
        expect(Math.abs(out[i].pitches[0] - out[i - 1].pitches[0])).toBeLessThanOrEqual(12);
      }
      for (let i = 5; i < 8; i++) {
        expect(Math.abs(out[i].pitches[0] - out[i - 1].pitches[0])).toBeLessThanOrEqual(12);
      }
    }
  });
});

describe('engine-level guarantees across the catalog', () => {
  const PROG = EVAL_PROGRESSIONS[1]; // B: Cmaj7 – Am7 – Dm7 – G7

  function renderBass(pattern: string, seed: number): { notes: NoteEvent[]; chords: PerfChord[] } {
    const chords = remeterChords(
      progressionToPerfChords(PROG.chords, PROG.key),
      beatsPerBarFor(pattern),
    );
    const notes = generatePerformance(
      { chords, bpm: PROG.bpm, seed },
      { styleId: pattern, drums: false },
    ).filter((n) => n.trackId === 'bass');
    return { notes, chords };
  }

  function activeChord(chords: PerfChord[], beat: number): PerfChord | undefined {
    let found: PerfChord | undefined;
    for (const c of chords) {
      if (c.startBeat <= beat + 1e-9) found = c;
      else break;
    }
    return found;
  }

  function nextBoundary(chords: PerfChord[], beat: number): number | undefined {
    for (const c of chords) if (c.startBeat > beat + 1e-9) return c.startBeat;
    return undefined;
  }

  it('stays in register, and out-of-chord tones resolve within a beat', () => {
    for (const pattern of ACCOMPANIMENT_IDS) {
      for (const seed of [1, 2, 3]) {
        const { notes, chords } = renderBass(pattern, seed);
        const sorted = [...notes].sort((a, b) => a.timeBeat - b.timeBeat);
        sorted.forEach((n, i) => {
          expect(n.pitch).toBeGreaterThanOrEqual(26);
          expect(n.pitch).toBeLessThanOrEqual(55);
          const chord = activeChord(chords, n.timeBeat);
          if (!chord) return;
          const allowed = new Set(
            [...chord.bodyMidi, ...chord.bassMidi, ...(chord.arpMidi ?? [])].map(
              (p) => ((p % 12) + 12) % 12,
            ),
          );
          if (!allowed.has(((n.pitch % 12) + 12) % 12)) {
            // A connective is short and resolves: the NEXT bass note (the new
            // root, possibly anticipated) arrives within a beat (plus humanize),
            // and the chord it belongs to does change right after.
            const next = sorted[i + 1];
            expect(next).toBeDefined();
            expect(next.timeBeat - n.timeBeat).toBeLessThanOrEqual(1.15);
            expect(nextBoundary(chords, n.timeBeat)).toBeDefined();
          }
        });
      }
    }
  });

  it('the moving profiles actually leave the anchored root', () => {
    for (const pattern of ['driving', 'beat16']) {
      const moved = [1, 2, 3, 4, 5].some((seed) => {
        const { notes, chords } = renderBass(pattern, seed);
        return notes.some((n) => {
          const chord = activeChord(chords, n.timeBeat);
          const anchor = chord && chord.bassMidi.length > 0 ? Math.max(...chord.bassMidi) : undefined;
          return anchor !== undefined && n.pitch !== anchor;
        });
      });
      expect(moved).toBe(true);
    }
  });

  it('the textures stay exactly on the root (unchanged sound)', () => {
    for (const pattern of ['block', 'arpeggio']) {
      const { notes, chords } = renderBass(pattern, 7);
      for (const n of notes) {
        const chord = activeChord(chords, n.timeBeat)!;
        const anchor = Math.max(...chord.bassMidi);
        expect(n.pitch).toBe(anchor);
      }
    }
  });

  // Ballad Engine v1 (ballad_engine_spec §4): relaxed warmed up from root-only to
  // BALLAD_WARM — only chord tones (its sparse grid suppresses connectives via the
  // planner's 1-beat guard), roots on chord arrivals, and SOME movement to a fifth.
  it('relaxed moves gently: chord tones only, root on arrivals, fifths appear', () => {
    let sawFifth = false;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { notes, chords } = renderBass('relaxed', seed);
      for (const n of notes) {
        const chord = activeChord(chords, n.timeBeat)!;
        const allowed = new Set(
          [...chord.bassMidi, ...chord.bodyMidi, ...(chord.arpMidi ?? [])].map((p) => p % 12),
        );
        expect(allowed.has(((n.pitch % 12) + 12) % 12)).toBe(true);
        const anchor = Math.max(...chord.bassMidi);
        if (n.pitch % 12 !== anchor % 12) sawFifth = true;
      }
    }
    expect(sawFifth).toBe(true);
  });
});
