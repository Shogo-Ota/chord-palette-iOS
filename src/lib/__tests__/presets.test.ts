import { PRESETS } from '@/data/presets';
import { buildPresetProgression } from '@/lib/presets';
import type { Preset } from '@/types';

function preset(id: string): Preset {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`missing preset ${id}`);
  return p;
}

describe('buildPresetProgression', () => {
  it('renders the royal progression (4536: IV-V-iii-vi) in C', () => {
    const chords = buildPresetProgression(preset('jpop-royal'), 'C');
    expect(chords.map((c) => c.displayName)).toEqual(['F', 'G', 'Em', 'Am']);
  });

  it('auto-transposes the royal progression to G', () => {
    const chords = buildPresetProgression(preset('jpop-royal'), 'G');
    expect(chords.map((c) => c.displayName)).toEqual(['C', 'D', 'Bm', 'Em']);
  });

  it('renders City Pop sevenths in C', () => {
    const chords = buildPresetProgression(preset('city-pop'), 'C');
    expect(chords.map((c) => c.displayName)).toEqual(['Fmaj7', 'G7', 'Em7', 'Am7']);
  });

  it('keeps every preset within 4 bars (16 beats)', () => {
    for (const p of PRESETS) {
      const beats = buildPresetProgression(p, 'C').reduce((s, c) => s + c.durationBeats, 0);
      expect(beats).toBe(16);
    }
  });

  it('produces placed chords that are not themselves Pro-locked', () => {
    const chords = buildPresetProgression(preset('city-pop'), 'C');
    expect(chords.every((c) => c.isPro === false)).toBe(true);
  });
});
