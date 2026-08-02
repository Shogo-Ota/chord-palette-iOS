/**
 * Ballad Engine v1 calibration (docs/engine_specs/ballad_engine_spec.md §11–12).
 *
 * Freezes the numbers that make the ballad feel a BALLAD — laid-back microtiming,
 * legato gate, soft velocity centers, warm bass movement, phrase-end breathing —
 * so a future tuning pass cannot silently drift them. Any intentional recalibration
 * must update this file alongside the data, with the spec section it follows.
 */

import { bassProfileFor } from '@/lib/performance/bass/profiles';
import { RELAXED_VARIATION } from '@/lib/performance/feel/profiles';
import { resolveFeelTemplate } from '@/lib/performance/feel/templates';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import { generatePerformance, type PerfChord } from '@/lib/performance/PerformanceEngine';
import { BALLAD } from '@/lib/performance/styles/ballad';

const CTX = { tempoBpm: 72, grooveId: 'pop8' };

/** Eight bars of I–V–vi–IV at ballad tempo. */
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

function render(variantId?: string, seed = 7): NoteEvent[] {
  return generatePerformance(
    { chords: chords(), bpm: 72, seed },
    { styleId: 'relaxed', variantId, drums: false },
  );
}

describe('feel template (spec §7–8: laid-back, legato, soft)', () => {
  const { template, humanizeScale } = resolveFeelTemplate('relaxed', CTX);

  it('sits BEHIND the beat: chord/bass microtiming windows are non-negative', () => {
    expect(template.microtiming.chord).toEqual({ min: 2, max: 12 });
    expect(template.microtiming.bass).toEqual({ min: 1, max: 8 });
  });

  it('rings legato with a loose humanize window', () => {
    expect(template.gate.sustain).toBe('legato');
    expect(template.gate.min).toBeGreaterThanOrEqual(0.85);
    expect(humanizeScale).toBeCloseTo(1.15);
  });

  it('keeps the soft velocity centers of the ballad base', () => {
    expect(BALLAD.velocity.center.chord).toBe(66);
    expect(BALLAD.velocity.center.bass).toBe(74);
    expect(BALLAD.velocity.accentDepth).toBe(26);
  });

  it('answers with a single top-voice third on beat 3', () => {
    expect(template.topTone).toBe('third');
    expect(template.top?.hits).toEqual([false, false, false, false, true, false, false, false]);
  });
});

describe('variation profile (spec §9: the phrase breathes at its end)', () => {
  it('thins bar 4 more often than it adds mid-phrase stabs', () => {
    expect(RELAXED_VARIATION.twoFourBar).toEqual({ probability: 0.45, maxPerPhrase: 1 });
    expect(RELAXED_VARIATION.phraseFill).toEqual({
      sustainFinal: true,
      extraStabProbability: 0.2,
    });
  });
});

describe('bass profile (spec §4: BALLAD_WARM)', () => {
  it('is mostly root with the odd fifth, connectives kept rare', () => {
    expect(bassProfileFor('relaxed')).toEqual({
      figures: ['rootFifth', 'rootOnly'],
      approachChance: 0.15,
      passing: false,
    });
  });
});

describe('relaxed.arpSlow variant (spec §3: rise, then hold)', () => {
  it('spreads the chord one note at a time', () => {
    const attacks = render('relaxed.arpSlow')
      .filter((n) => n.trackId === 'chord')
      .reduce<Record<string, number>>((acc, n) => {
        const k = n.timeBeat.toFixed(3);
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
    expect(Object.values(attacks).every((c) => c === 1)).toBe(true);
  });

  it('some bar climbs through beats 1–2 and rings a longer note after', () => {
    const notes = render('relaxed.arpSlow')
      .filter((n) => n.trackId === 'chord')
      .sort((a, b) => a.timeBeat - b.timeBeat);
    let sawRise = false;
    let sawHold = false;
    for (let bar = 0; bar < 8; bar++) {
      const inBar = notes.filter(
        (n) => n.timeBeat >= bar * 4 - 0.25 && n.timeBeat < (bar + 1) * 4 - 0.25,
      );
      const firstHalf = inBar.filter((n) => n.timeBeat < bar * 4 + 2 - 0.25);
      if (
        firstHalf.length >= 3 &&
        firstHalf.every((n, i) => i === 0 || n.pitch > firstHalf[i - 1].pitch)
      ) {
        sawRise = true;
      }
      if (inBar.some((n) => n.durationBeat >= 1.2)) sawHold = true;
    }
    expect(sawRise).toBe(true);
    expect(sawHold).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    const sig = (notes: NoteEvent[]) =>
      notes.map((n) => `${n.timeBeat.toFixed(4)}:${n.pitch}:${n.velocity}`).join('|');
    expect(sig(render('relaxed.arpSlow', 11))).toBe(sig(render('relaxed.arpSlow', 11)));
  });
});
