/**
 * City Engine v1 calibration (docs/engine_specs/city_engine_spec.md §11–12).
 *
 * Freezes what makes the 16-beat comp read 洗練: tightened chord timing and
 * velocity spread (the grains line up), and a bass that sings on fifths
 * instead of pumping octaves. Intentional recalibration must update this
 * file with the data.
 */

import { bassProfileFor } from '@/lib/performance/bass/profiles';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import { generatePerformance, type PerfChord } from '@/lib/performance/PerformanceEngine';
import { SIXTEEN_BEAT } from '@/lib/performance/styles/sixteenBeat';

/** Eight bars of I–V–vi–IV at a city tempo. */
function chords(): PerfChord[] {
  const roots = [60, 67, 69, 65, 60, 67, 69, 65];
  return roots.map((root, bar) => ({
    bodyMidi: [root, root + 4, root + 7],
    bassMidi: [root - 24],
    arpMidi: [root, root + 4, root + 7, root + 11],
    startBeat: bar * 4,
    durationBeats: 4,
  }));
}

function renderBass(seed: number): NoteEvent[] {
  return generatePerformance(
    { chords: chords(), bpm: 104, seed },
    { styleId: 'beat16', drums: false },
  ).filter((n) => n.trackId === 'bass');
}

describe('16-beat skeleton (spec §7/§9: polish = grains lining up)', () => {
  it('keeps the tightened timing and velocity spread', () => {
    expect(SIXTEEN_BEAT.microtiming.chord).toEqual({ min: -3, max: 3 });
    expect(SIXTEEN_BEAT.velocity.humanizeMin).toBe(3);
    expect(SIXTEEN_BEAT.velocity.humanizeMax).toBe(5);
    expect(SIXTEEN_BEAT.velocity.accentDepth).toBe(36);
  });
});

describe('bass profile (spec §4 CITY_SMOOTH)', () => {
  it('sings on fifths — no octave figure, moderate connectives', () => {
    expect(bassProfileFor('beat16')).toEqual({
      figures: ['rootFifth', 'rootOnly'],
      approachChance: 0.4,
      passing: true,
    });
  });

  it('a beat16 render never pumps the octave anymore', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const anchors = chords();
      for (const n of renderBass(seed)) {
        const chord = anchors.filter((c) => c.startBeat <= n.timeBeat + 1e-9).pop();
        if (!chord) continue;
        expect(n.pitch).not.toBe(Math.max(...chord.bassMidi) + 12);
      }
    }
  });

  it('but the line still moves (fifths appear across seeds)', () => {
    let moved = false;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const anchors = chords();
      for (const n of renderBass(seed)) {
        const chord = anchors.filter((c) => c.startBeat <= n.timeBeat + 1e-9).pop();
        const anchor = chord ? Math.max(...chord.bassMidi) : undefined;
        if (anchor !== undefined && n.pitch % 12 !== anchor % 12) moved = true;
      }
    }
    expect(moved).toBe(true);
  });
});
