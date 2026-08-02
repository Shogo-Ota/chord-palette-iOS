/**
 * Determinism (implementation_v1.01 Phase 10 「決定性」).
 *
 * The product contract is that a project always plays back the same take: the
 * same progression, rhythm, tempo and seed must yield a byte-identical
 * `NoteEvent[]`. This is what makes playback, the video export and every
 * before/after quality comparison trustworthy. Conversely a different seed must
 * be able to produce a different take (that is what humanization is for), which
 * is asserted on the Natural feel where the seed drives both the template
 * rotation and the microtiming streams.
 */

import { ACCOMPANIMENT_IDS } from '@/data/labels';
import { EVAL_PROGRESSIONS } from '@/lib/performance/analysis/fixtures';
import { generatePerformance } from '@/lib/performance/PerformanceEngine';
import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import { remeterChords } from '@/lib/performance/meter';
import { beatsPerBarFor } from '@/lib/performance/rhythms';
import type { AccompanimentPattern } from '@/types';

const PROG = EVAL_PROGRESSIONS[1]; // B: Cmaj7 – Am7 – Dm7 – G7

function render(pattern: AccompanimentPattern | string, seed: number, bpm = PROG.bpm) {
  const authored = progressionToPerfChords(PROG.chords, PROG.key);
  const chords = remeterChords(authored, beatsPerBarFor(pattern));
  return generatePerformance({ chords, bpm, seed }, { styleId: pattern, drums: true });
}

describe('same input + same seed ⇒ identical events', () => {
  it('holds for every rhythm in the catalog', () => {
    for (const pattern of ACCOMPANIMENT_IDS) {
      expect(render(pattern, 7)).toEqual(render(pattern, 7));
    }
  });

  it('holds at different tempi', () => {
    for (const bpm of [60, 120, 180]) {
      expect(render('natural', 7, bpm)).toEqual(render('natural', 7, bpm));
    }
  });

  it('voice leading itself is deterministic', () => {
    expect(progressionToPerfChords(PROG.chords, PROG.key)).toEqual(
      progressionToPerfChords(PROG.chords, PROG.key),
    );
  });
});

describe('the seed is the only source of variation', () => {
  it('a different seed produces a different Natural take', () => {
    expect(render('natural', 7)).not.toEqual(render('natural', 8));
  });

  it('but the same notes land on the grid (structure is seed-independent)', () => {
    // Humanize moves timing/velocity within a window; it must never change WHICH
    // pitches play. Block bypasses the (intentionally seed-driven) Variation layer,
    // so its pitch multiset must be identical across seeds.
    const pitches = (seed: number) =>
      render('block', seed)
        .map((n) => `${n.trackId}:${n.pitch}`)
        .sort();
    expect(pitches(7)).toEqual(pitches(8));
  });
});
