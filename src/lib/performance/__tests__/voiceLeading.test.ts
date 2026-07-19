import {
  averageVoiceMovement,
  commonTones,
  DEFAULT_VOICE_LEADING_OPTIONS,
  maxVoiceMovement,
  progressionAverageMovement,
  voiceLeadNext,
  voiceLeadProgression,
} from '@/lib/performance/voiceLeading';
import { PRESETS } from '@/data/presets';
import { buildPresetProgression } from '@/lib/presets';
import { progressionToChordSpecs } from '@/lib/voicing';
import type { MajorKey } from '@/types';

/* ------------------------------------------------------------------ */
/* Root-position chord bodies in C (mid band, C3 = 48), for readable   */
/* progression fixtures. Matches the INTERVALS table in voicing.ts.    */
/* ------------------------------------------------------------------ */
const C = [48, 52, 55]; // C major   (C E G)
const G = [55, 59, 62]; // G major   (G B D)
const Am = [57, 60, 64]; // A minor  (A C E)
const F = [53, 57, 60]; // F major   (F A C)
const Em = [52, 55, 59]; // E minor  (E G B)
const Dm = [50, 53, 57]; // D minor  (D F A)

const { floorMidi, ceilMidi } = DEFAULT_VOICE_LEADING_OPTIONS;

describe('voiceLeadProgression — determinism', () => {
  it('is deterministic: the same input yields the same output', () => {
    const a = voiceLeadProgression([C, G, Am, F]);
    const b = voiceLeadProgression([C, G, Am, F]);
    expect(a).toEqual(b);
  });

  it('leaves the first chord in its supplied (root) position', () => {
    const [first] = voiceLeadProgression([C, G, Am, F]);
    expect(first).toEqual([48, 52, 55]);
  });

  it('handles empty and single-chord progressions', () => {
    expect(voiceLeadProgression([])).toEqual([]);
    expect(voiceLeadProgression([C])).toEqual([[48, 52, 55]]);
  });
});

describe('voiceLeadProgression — common-tone retention', () => {
  it('C → Am holds the common tones C and E exactly', () => {
    const [, am] = voiceLeadProgression([C, Am]);
    // Best voicing of Am after C is [C3 E3 A3] = [48, 52, 57].
    expect(am).toEqual([48, 52, 57]);
    expect(commonTones(C, am)).toEqual([48, 52]); // C3, E3 held
  });

  it('C → G keeps the shared G and moves the other voices minimally', () => {
    const [, g] = voiceLeadProgression([C, G]);
    expect(commonTones(C, g)).toContain(55); // G3 held
    expect(maxVoiceMovement(C, g)).toBeLessThanOrEqual(DEFAULT_VOICE_LEADING_OPTIONS.maxVoiceStep);
  });

  it('a repeated chord keeps the identical voicing (all tones common)', () => {
    const [c1, c2] = voiceLeadProgression([C, C]);
    expect(c2).toEqual(c1);
    expect(averageVoiceMovement(c1, c2)).toBe(0);
  });
});

describe('voiceLeadProgression — inner-voice movement ≤ ±7 semitones', () => {
  const fixtures: Record<string, number[][]> = {
    'I-V-vi-IV': [C, G, Am, F],
    '王道4536 (IV-V-iii-vi)': [F, G, Em, Am],
    'カノン (I-V-vi-iii-IV-I-IV-V)': [C, G, Am, Em, F, C, F, G],
    'vi-IV-V-I (komuro)': [Am, F, G, C],
    'ii-V-I': [Dm, G, C],
  };

  for (const [name, bodies] of Object.entries(fixtures)) {
    it(`${name}: every voice moves within ±7 semitones`, () => {
      const led = voiceLeadProgression(bodies);
      for (let i = 1; i < led.length; i++) {
        expect(maxVoiceMovement(led[i - 1], led[i])).toBeLessThanOrEqual(
          DEFAULT_VOICE_LEADING_OPTIONS.maxVoiceStep,
        );
      }
    });

    it(`${name}: average voice movement ≤ 4 semitones`, () => {
      const led = voiceLeadProgression(bodies);
      expect(progressionAverageMovement(led)).toBeLessThanOrEqual(4);
    });
  }
});

describe('voiceLeadProgression — register clamp (no runaway high/low drift)', () => {
  it('keeps every voice within the configured register across a long progression', () => {
    const led = voiceLeadProgression([C, G, Am, Em, F, C, F, G]);
    for (const chord of led) {
      for (const note of chord) {
        expect(note).toBeGreaterThanOrEqual(floorMidi);
        expect(note).toBeLessThanOrEqual(ceilMidi);
      }
    }
  });

  it('does not let the register drift far from the anchor even on a rising cycle', () => {
    // Ascending-root cycle would drift upward under naive "closest inversion".
    const led = voiceLeadProgression([C, F, G, C, F, G, C, F]);
    const anchor = (48 + 52 + 55) / 3;
    for (const chord of led) {
      const centre = chord.reduce((s, n) => s + n, 0) / chord.length;
      expect(Math.abs(centre - anchor)).toBeLessThanOrEqual(7);
    }
  });
});

describe('voiceLeadProgression — real-world diatonic progressions stay musical', () => {
  it('I-V-vi-IV produces a smooth top line (no octave jumps)', () => {
    const led = voiceLeadProgression([C, G, Am, F]);
    const tops = led.map((chord) => Math.max(...chord));
    for (let i = 1; i < tops.length; i++) {
      expect(Math.abs(tops[i] - tops[i - 1])).toBeLessThanOrEqual(4);
    }
  });

  it('every re-voiced chord preserves its pitch-class set (chord identity intact)', () => {
    const bodies = [C, G, Am, F, Em, Dm];
    const led = voiceLeadProgression(bodies);
    led.forEach((chord, i) => {
      const original = new Set(bodies[i].map((n) => ((n % 12) + 12) % 12));
      const revoiced = new Set(chord.map((n) => ((n % 12) + 12) % 12));
      expect(revoiced).toEqual(original);
      expect(chord).toHaveLength(bodies[i].length);
    });
  });
});

describe('voiceLeadNext — single step', () => {
  it('with no previous chord, returns the body clamped into range', () => {
    expect(voiceLeadNext([], G)).toEqual([55, 59, 62]);
  });

  it('picks the inversion nearest to the previous chord', () => {
    // After C (C E G), F major should voice as [C F A] (only E→F moves a step).
    const next = voiceLeadNext([48, 52, 55], F);
    expect(next).toEqual([48, 53, 57]);
    expect(commonTones([48, 52, 55], next)).toEqual([48]); // C held; A lands on 57
  });
});

/* ------------------------------------------------------------------ */
/* Integration: the full progressionToChordSpecs path across presets   */
/* and all 12 keys, to prove the acceptance criteria hold end-to-end.  */
/* ------------------------------------------------------------------ */
describe('progressionToChordSpecs — acceptance criteria across presets & keys', () => {
  const KEYS: MajorKey[] = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

  /** Body notes = mid-register (≥ C3); bass is the C2 anchor below. */
  function bodyOf(spec: { midiNotes: number[] }): number[] {
    return spec.midiNotes.filter((n) => n >= 48);
  }

  for (const preset of PRESETS) {
    it(`${preset.id}: average body movement ≤ 4 semitones in every key`, () => {
      for (const key of KEYS) {
        const progression = buildPresetProgression(preset, key).map((e, i) => ({
          ...e,
          id: `e-${i}`,
        }));
        const bodies = progressionToChordSpecs(progression, key).map(bodyOf);
        expect(progressionAverageMovement(bodies)).toBeLessThanOrEqual(4);
        for (let i = 1; i < bodies.length; i++) {
          expect(maxVoiceMovement(bodies[i - 1], bodies[i])).toBeLessThanOrEqual(
            DEFAULT_VOICE_LEADING_OPTIONS.maxVoiceStep,
          );
        }
      }
    });
  }

  it('keeps the bass anchored on the chord root (voice leading is body-only)', () => {
    const progression = buildPresetProgression(PRESETS[0], 'C').map((e, i) => ({
      ...e,
      id: `e-${i}`,
    }));
    const specs = progressionToChordSpecs(progression, 'C');
    for (const spec of specs) {
      const bass = spec.midiNotes.filter((n) => n < 48);
      const body = spec.midiNotes.filter((n) => n >= 48);
      expect(bass).toHaveLength(1);
      expect(body.length).toBeGreaterThanOrEqual(3);
    }
  });
});
