import { PRESETS, STARTER_PRESET } from '@/data/presets';
import { buildPresetProgression } from '@/lib/presets';
import type { Preset } from '@/types';

/** Inline seventh-chord preset fixture (the catalog is user-curated / empty now). */
const CITY_POP: Preset = {
  id: 'fixture-city-pop',
  name: 'City Pop (fixture)',
  category: 'pro',
  chordsDisplay: 'FM7 · G7 · Em7 · Am7',
  tags: [],
  accent: '#22c55e',
  chords: [
    { offset: 5, suffix: 'maj7', function: 'subdominant', degreeLabel: 'IVmaj7', durationBeats: 4 },
    { offset: 7, suffix: '7', function: 'dominant', degreeLabel: 'V7', durationBeats: 4 },
    { offset: 4, suffix: 'm7', function: 'tonic', degreeLabel: 'iiim7', durationBeats: 4 },
    { offset: 9, suffix: 'm7', function: 'tonic', degreeLabel: 'vim7', durationBeats: 4 },
  ],
};

describe('buildPresetProgression', () => {
  it('renders the starter royal progression (4536: IV-V-iii-vi) in C', () => {
    const chords = buildPresetProgression(STARTER_PRESET, 'C');
    expect(chords.map((c) => c.displayName)).toEqual(['F', 'G', 'Em', 'Am']);
  });

  it('auto-transposes the starter progression to G', () => {
    const chords = buildPresetProgression(STARTER_PRESET, 'G');
    expect(chords.map((c) => c.displayName)).toEqual(['C', 'D', 'Bm', 'Em']);
  });

  it('renders City Pop sevenths in C', () => {
    const chords = buildPresetProgression(CITY_POP, 'C');
    expect(chords.map((c) => c.displayName)).toEqual(['Fmaj7', 'G7', 'Em7', 'Am7']);
  });

  it('keeps the starter progression within 4 bars (16 beats)', () => {
    const beats = buildPresetProgression(STARTER_PRESET, 'C').reduce((s, c) => s + c.durationBeats, 0);
    expect(beats).toBe(16);
  });

  it('produces placed chords that are not themselves Pro-locked', () => {
    const chords = buildPresetProgression(CITY_POP, 'C');
    expect(chords.every((c) => c.isPro === false)).toBe(true);
  });

  it('ships no built-in catalog (presets are user-curated)', () => {
    expect(PRESETS).toEqual([]);
  });
});
