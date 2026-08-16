/**
 * Band Engine v1 calibration (docs/engine_specs/band_engine_spec.md §11–12).
 *
 * Freezes the numbers that make the band feel a BAND — widened on/off accent
 * contrast, forward-pushing phrase ends, the octave-pump bass option, the
 * driving feel's tight humanize — so a future tuning pass cannot silently
 * drift them. Intentional recalibration must update this file with the data.
 */

import { bassProfileFor } from '@/lib/performance/bass/profiles';
import { resolveFeelTemplate } from '@/lib/performance/feel/templates';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import { generatePerformance, type PerfChord } from '@/lib/performance/PerformanceEngine';
import { EIGHT_VARIATION } from '@/lib/performance/rhythms/variations';
import { EIGHT_BEAT } from '@/lib/performance/styles/eightBeat';

/** Eight bars of I–V–vi–IV at a band tempo. */
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

function render(pattern: string, seed = 7): NoteEvent[] {
  return generatePerformance(
    { chords: chords(), bpm: 108, seed },
    { styleId: pattern, drums: false },
  );
}

describe('8-beat skeleton (spec §11-1: accent contrast IS the drive)', () => {
  it('keeps the widened on/off contrast', () => {
    expect(EIGHT_BEAT.chord.accent).toEqual([1.0, 0.5, 0.5, 0.66, 0.9, 0.5, 0.5, 0.7]);
    expect(EIGHT_BEAT.velocity.accentDepth).toBe(40);
    expect(EIGHT_BEAT.velocity.center.chord).toBe(80);
  });

  it('keeps the half-beat 食い', () => {
    expect(EIGHT_BEAT.anticipation).toEqual({ maxLeadBeats: 0.5 });
  });
});

describe('variation profile (spec §9: the phrase end pushes, never lands)', () => {
  it('trades the final ring for pickup stabs', () => {
    expect(EIGHT_VARIATION.phraseFill).toEqual({
      sustainFinal: false,
      extraStabProbability: 0.55,
    });
    expect(EIGHT_VARIATION.twoFourBar).toEqual({ probability: 0.5, maxPerPhrase: 1 });
    expect(EIGHT_VARIATION.bassOnly.probability).toBe(0);
  });
});

describe('driving feel (the Band card rides it over the rock kit)', () => {
  it('picks the 8-feel below the 16 threshold and the 16-feel above it', () => {
    const slow = resolveFeelTemplate('driving', { tempoBpm: 100, grooveId: 'rock8' });
    const fast = resolveFeelTemplate('driving', { tempoBpm: 130, grooveId: 'rock8' });
    expect(slow.template.stepsPerBar).toBe(8);
    expect(fast.template.stepsPerBar).toBe(16);
  });

  it('stays tight and forward-leaning', () => {
    const { template, humanizeScale } = resolveFeelTemplate('driving', {
      tempoBpm: 100,
      grooveId: 'rock8',
    });
    expect(humanizeScale).toBeCloseTo(0.82);
    expect(template.anticipation).toEqual({ maxLeadBeats: 0.5 });
    // accentDepthDelta +9 lands on the widened 8-beat base.
    expect(template.velocity.accentDepth).toBe(40 + 9);
    expect(template.gate.min).toBeGreaterThanOrEqual(0.68);
  });
});

describe('bass profiles (spec §4)', () => {
  it('beat8 gains the occasional octave pump; driving keeps its pump-first line', () => {
    expect(bassProfileFor('beat8')).toEqual({
      figures: ['rootFifth', 'rootOnly', 'rootOctave'],
      approachChance: 0.5,
      passing: true,
    });
    expect(bassProfileFor('driving')).toEqual({
      figures: ['rootOctave', 'rootFifth'],
      approachChance: 0.6,
      passing: true,
    });
  });

  it('the octave pump is actually reachable in a beat8 render', () => {
    let sawOctave = false;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const bass = render('beat8', seed).filter((n) => n.trackId === 'bass');
      const anchors = chords();
      for (const n of bass) {
        const chord = anchors.filter((c) => c.startBeat <= n.timeBeat + 1e-9).pop();
        if (chord && n.pitch === Math.max(...chord.bassMidi) + 12) sawOctave = true;
      }
    }
    expect(sawOctave).toBe(true);
  });
});

describe('band vs ballad character (spec §12-3: the styles must read apart)', () => {
  it('beat8 hits harder than relaxed on the same progression', () => {
    const mean = (pattern: string) => {
      const v = render(pattern)
        .filter((n) => n.trackId === 'chord')
        .map((n) => n.velocity);
      return v.reduce((a, b) => a + b, 0) / v.length;
    };
    expect(mean('beat8')).toBeGreaterThan(mean('relaxed'));
  });
});
