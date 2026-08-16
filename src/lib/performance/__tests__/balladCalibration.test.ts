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
import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { variantsFor } from '@/lib/performance/variants';
import type { ChordEvent } from '@/types';

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
    expect(BALLAD.velocity.center.chord).toBe(68);
    expect(BALLAD.velocity.center.bass).toBe(72);
    expect(BALLAD.velocity.accentDepth).toBe(30);
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
      extraStabProbability: 0.22,
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

describe('ballad Types (real teacher takes, not synthetic readings)', () => {
  function balladPlan(variantId: string) {
    return buildSessionPerformancePlan({
      key: 'C',
      tempoBpm: 72,
      grooveId: 'pop8',
      accompanimentPattern: 'relaxed',
      accompanimentVariant: variantId,
      instrumentId: 'piano',
      accompanimentEnergy: 'build',
      octaveShift: 1,
      releaseCut: true,
      drumMode: 'off',
      progression: [0, 7, 9, 5].map(
        (rootOffset, i) =>
          ({
            id: `b${i}`,
            chordId: `b${i}`,
            displayName: `b${i}`,
            degreeLabel: 'I',
            function: 'tonic',
            durationBeats: 4,
            isPro: false,
            rootOffset,
            suffix: '',
          }) as ChordEvent,
      ),
    });
  }

  const sig = (notes: NoteEvent[]) =>
    notes.map((n) => `${n.timeBeat.toFixed(4)}:${n.pitch}:${n.velocity}`).join('|');

  it('every Type plays, and no two Types play the same take', () => {
    const types = variantsFor('relaxed');
    expect(types.length).toBeGreaterThan(1);
    const takes = new Set<string>();
    for (const t of types) {
      const notes = balladPlan(t.id).notes;
      expect(notes.length).toBeGreaterThan(0);
      takes.add(sig(notes));
    }
    expect(takes.size).toBe(types.length);
  });

  it('is deterministic for a given Type', () => {
    for (const t of variantsFor('relaxed')) {
      expect(sig(balladPlan(t.id).notes)).toBe(sig(balladPlan(t.id).notes));
    }
  });
});
