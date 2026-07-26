import { diatonicSevenths, diatonicTriads } from '@/data/music';
import { PRESETS, STARTER_PRESET } from '@/data/presets';
import { buildPresetProgression } from '@/lib/presets';
import { BEATS_PER_BAR, MAX_BARS } from '@/lib/progression';
import type { Preset, PresetChord } from '@/types';

/**
 * Every (offset, suffix) pair a free user can place from the diatonic library.
 * Colour variations (add9 / sus4) are free too but no preset uses them, so the set
 * stays deliberately narrow — if a preset ever needs one, widen this on purpose.
 */
const FREE_CHORDS = new Set(
  [...diatonicTriads('C'), ...diatonicSevenths('C')].map((c) => `${c.rootOffset}|${c.suffix}`),
);

function isFree(c: PresetChord): boolean {
  // Slash / on-chords are Palette Pro regardless of what sits on top.
  if (c.bassOffset != null) return false;
  return FREE_CHORDS.has(`${c.offset}|${c.suffix}`);
}

function bars(preset: Preset): number {
  return preset.chords.reduce((n, c) => n + c.durationBeats, 0) / BEATS_PER_BAR;
}

describe('preset catalog', () => {
  it('ships presets on both sides of the paywall', () => {
    // The Pro tier advertises presets on the paywall; an empty Pro section is the
    // 2.3.1 (inaccurate metadata) rejection this catalog exists to prevent.
    expect(PRESETS.filter((p) => p.category === 'free').length).toBeGreaterThan(0);
    expect(PRESETS.filter((p) => p.category === 'pro').length).toBeGreaterThan(0);
  });

  it('gives every preset its own id', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps free presets playable without Palette Pro', () => {
    for (const preset of PRESETS.filter((p) => p.category === 'free')) {
      const locked = preset.chords.filter((c) => !isFree(c));
      expect({ preset: preset.id, locked }).toEqual({ preset: preset.id, locked: [] });
    }
  });

  it('seeds the starter progression from free chords too', () => {
    expect(STARTER_PRESET.chords.every(isFree)).toBe(true);
  });

  it('gives every Pro preset a reason to be locked', () => {
    for (const preset of PRESETS.filter((p) => p.category === 'pro')) {
      // A progression a free user could rebuild chord-by-chord is a lock with
      // nothing behind it, so each Pro preset must need a secondary dominant,
      // a borrowed chord or a slash chord.
      expect({ preset: preset.id, needsPro: preset.chords.some((c) => !isFree(c)) }).toEqual({
        preset: preset.id,
        needsPro: true,
      });
    }
  });

  it('fits every preset inside the 16-bar cap', () => {
    for (const preset of PRESETS) {
      expect({ preset: preset.id, ok: bars(preset) <= MAX_BARS }).toEqual({
        preset: preset.id,
        ok: true,
      });
    }
  });

  it('fills whole bars so a preset never lands mid-bar', () => {
    for (const preset of PRESETS) {
      expect({ preset: preset.id, bars: bars(preset) % 1 }).toEqual({ preset: preset.id, bars: 0 });
    }
  });

  it('shows the chords it actually builds in C', () => {
    for (const preset of PRESETS) {
      const built = buildPresetProgression(preset, 'C')
        .map((c) => c.displayName)
        .join(' · ');
      expect({ preset: preset.id, display: preset.chordsDisplay }).toEqual({
        preset: preset.id,
        display: built,
      });
    }
  });

  it('transposes by degree rather than by name', () => {
    const royal = PRESETS.find((p) => p.id === 'royal-4536')!;
    expect(buildPresetProgression(royal, 'G').map((c) => c.displayName)).toEqual([
      'C',
      'D',
      'Bm',
      'Em',
    ]);
  });

  it('carries the bass through a transposed slash chord', () => {
    const walk = PRESETS.find((p) => p.id === 'descending-bass')!;
    const inF = buildPresetProgression(walk, 'F');
    expect(inF[1].displayName).toBe('C/E');
    expect(inF[1].degreeLabel).toBe('V/VII');
  });

  it('paints each preset with a colour the tag renderer knows', () => {
    // src/app/presets.tsx maps the accent to a readable tag text colour and falls
    // back to muted grey for anything unexpected.
    const KNOWN = ['#eab308', '#d6409f', '#3b82f6', '#ef4444', '#8b5cf6', '#22c55e'];
    for (const preset of PRESETS) {
      expect({ preset: preset.id, accent: KNOWN.includes(preset.accent) }).toEqual({
        preset: preset.id,
        accent: true,
      });
    }
  });
});
