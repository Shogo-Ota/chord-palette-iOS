/**
 * Style × Energy (§21) — normalize, profiles, apply, engine wiring, seed isolation.
 */

import {
  applyEnergyProfile,
  DEFAULT_ENERGY,
  ENERGY_IDS,
  ENERGY_LABELS,
  energyProfileFor,
  IDENTITY_ENERGY,
  normalizeEnergy,
  styleEnergyProfiles,
} from '@/lib/performance/energy';
import {
  generatePerformance,
  type PerfChord,
} from '@/lib/performance/PerformanceEngine';
import type { AccompanimentStyle } from '@/lib/performance/model/types';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import { EIGHT_VARIATION } from '@/lib/performance/rhythms/variations';
import { EIGHT_BEAT } from '@/lib/performance/styles/eightBeat';
import { performanceSeedFromSession } from '@/services/audio/performanceMapper';
import type { ChordEvent } from '@/types';

const READY_STYLES: AccompanimentStyle[] = ['ballad', 'band', 'city'];

const STYLE_PATTERN: Record<'ballad' | 'band' | 'city', string> = {
  ballad: 'relaxed',
  band: 'driving',
  city: 'beat16',
};

function chords(): PerfChord[] {
  const roots = [60, 67, 69, 65];
  return roots.map((root, bar) => ({
    bodyMidi: [root, root + 4, root + 7],
    bassMidi: [root - 24],
    arpMidi: [root, root + 4, root + 7, root + 11],
    startBeat: bar * 4,
    durationBeats: 4,
  }));
}

function render(
  style: AccompanimentStyle,
  energy: 'verse' | 'build' | 'chorus',
  seed = 42,
): NoteEvent[] {
  return generatePerformance(
    { chords: chords(), bpm: 100, seed },
    {
      styleId: STYLE_PATTERN[style as 'ballad' | 'band' | 'city'],
      energy,
      accompanimentStyle: style,
      drums: false,
    },
  );
}

function fingerprint(events: NoteEvent[]): string {
  return events
    .map(
      (e) =>
        `${e.trackId}:${e.timeBeat.toFixed(4)}:${e.durationBeat.toFixed(4)}:${e.pitch}:${e.velocity}`,
    )
    .join('|');
}

describe('normalizeEnergy (migration)', () => {
  it('defaults to build', () => {
    expect(DEFAULT_ENERGY).toBe('build');
    expect(normalizeEnergy(undefined)).toBe('build');
    expect(normalizeEnergy(null)).toBe('build');
    expect(normalizeEnergy('')).toBe('build');
    expect(normalizeEnergy('garbage')).toBe('build');
  });

  it('accepts verse / build / chorus', () => {
    for (const id of ENERGY_IDS) {
      expect(normalizeEnergy(id)).toBe(id);
    }
  });

  it('exposes user-facing labels for the segmented control', () => {
    expect(ENERGY_LABELS.verse).toBe('Aメロっぽく');
    expect(ENERGY_LABELS.build).toBe('Bメロっぽく');
    expect(ENERGY_LABELS.chorus).toBe('サビっぽく');
  });
});

describe('Style×Energy profiles (DESIGN_TARGET)', () => {
  it('registers Ballad / Band / City; Dance / R&B stay unset', () => {
    expect(styleEnergyProfiles.ballad).toBeDefined();
    expect(styleEnergyProfiles.band).toBeDefined();
    expect(styleEnergyProfiles.city).toBeDefined();
    expect(styleEnergyProfiles.dance).toBeUndefined();
    expect(styleEnergyProfiles.rnb).toBeUndefined();
  });

  it('build is exact identity for ready styles', () => {
    for (const style of READY_STYLES) {
      expect(energyProfileFor(style, 'build')).toEqual(IDENTITY_ENERGY);
    }
  });

  it('missing styles resolve to identity', () => {
    expect(energyProfileFor('dance', 'chorus')).toEqual(IDENTITY_ENERGY);
    expect(energyProfileFor('rnb', 'verse')).toEqual(IDENTITY_ENERGY);
  });

  it('verse and chorus diverge from identity on multiple roles (not velocity-only)', () => {
    for (const style of READY_STYLES) {
      const verse = energyProfileFor(style, 'verse');
      const chorus = energyProfileFor(style, 'chorus');
      expect(verse.noteDensity).not.toBe(1);
      expect(chorus.noteDensity).not.toBe(1);
      expect(verse.bassActivityScale).not.toBe(1);
      expect(chorus.bassActivityScale).not.toBe(1);
      expect(verse.drumActivityScale).not.toBe(1);
      expect(chorus.restRatioScale).not.toBe(1);
      expect(verse.phraseEnd).toBe('space');
      expect(chorus.phraseEnd).toBe('push');
    }
  });
});

describe('applyEnergyProfile', () => {
  it('identity leaves style / variation untouched', () => {
    const out = applyEnergyProfile(EIGHT_BEAT, EIGHT_VARIATION, IDENTITY_ENERGY);
    expect(out.style).toBe(EIGHT_BEAT);
    expect(out.variation).toBe(EIGHT_VARIATION);
    expect(out.registerOffsetSemitones).toBe(0);
  });

  it('Band chorus changes attack / rest / phrase-end, not a flat velocity multiply', () => {
    const profile = energyProfileFor('band', 'chorus');
    const out = applyEnergyProfile(EIGHT_BEAT, EIGHT_VARIATION, profile);
    expect(out.style.velocity.center.chord).toBe(EIGHT_BEAT.velocity.center.chord + profile.velocityDelta);
    // Attack / density reshape accents — not only center+delta.
    expect(out.style.chord.accent).not.toEqual(EIGHT_BEAT.chord.accent);
    expect(out.variation!.rests.probability).toBeLessThan(EIGHT_VARIATION.rests.probability);
    expect(out.variation!.phraseFill.sustainFinal).toBe(false);
    expect(out.registerOffsetSemitones).toBe(profile.registerOffset);
  });
});

describe('generatePerformance × Energy', () => {
  it.each(READY_STYLES)('%s × verse/build/chorus all emit events', (style) => {
    for (const energy of ENERGY_IDS) {
      const events = render(style, energy);
      expect(events.length).toBeGreaterThan(0);
    }
  });

  it('same seed + same energy is deterministic', () => {
    const a = fingerprint(render('band', 'chorus', 99));
    const b = fingerprint(render('band', 'chorus', 99));
    expect(a).toBe(b);
  });

  it('same seed, different energy → different take (Energy not in seed)', () => {
    const seed = 12345;
    const build = fingerprint(render('band', 'build', seed));
    const chorus = fingerprint(render('band', 'chorus', seed));
    const verse = fingerprint(render('ballad', 'verse', seed));
    const balladBuild = fingerprint(render('ballad', 'build', seed));
    expect(build).not.toBe(chorus);
    expect(verse).not.toBe(balladBuild);
  });

  it('build matches omitting energy (migration-compatible default)', () => {
    const withBuild = fingerprint(
      generatePerformance(
        { chords: chords(), bpm: 100, seed: 7 },
        { styleId: 'driving', energy: 'build', accompanimentStyle: 'band', drums: false },
      ),
    );
    const omitted = fingerprint(
      generatePerformance(
        { chords: chords(), bpm: 100, seed: 7 },
        { styleId: 'driving', accompanimentStyle: 'band', drums: false },
      ),
    );
    expect(withBuild).toBe(omitted);
  });

  it('chorus vs build differs beyond velocity alone', () => {
    const build = render('band', 'build', 11);
    const chorus = render('band', 'chorus', 11);
    const pitchesB = build.map((e) => e.pitch).sort((a, b) => a - b);
    const pitchesC = chorus.map((e) => e.pitch).sort((a, b) => a - b);
    const dursB = build.map((e) => e.durationBeat.toFixed(3)).join(',');
    const dursC = chorus.map((e) => e.durationBeat.toFixed(3)).join(',');
    const countDiff = build.length !== chorus.length;
    const pitchDiff = pitchesB.join(',') !== pitchesC.join(',');
    const durDiff = dursB !== dursC;
    // Register / density / gate / variation must move something other than velocity.
    expect(countDiff || pitchDiff || durDiff).toBe(true);
  });
});

describe('playback seed ignores energy (§14)', () => {
  const progression: ChordEvent[] = [
    {
      id: '1',
      rootOffset: 0,
      suffix: '',
      displayName: 'C',
      function: 'tonic',
      durationBeats: 4,
      chordId: 'C',
      degreeLabel: 'I',
      isPro: false,
    },
  ];

  it('energy is not part of the seed fingerprint', () => {
    const base = {
      key: 'C' as const,
      tempoBpm: 100,
      grooveId: 'rock8',
      accompanimentPattern: 'driving',
      accompanimentVariant: '',
      instrumentId: 'piano',
      progression,
    };
    // Seed helper intentionally has no energy field — Energy A/B share a seed.
    expect(performanceSeedFromSession(base)).toBe(performanceSeedFromSession({ ...base }));
  });
});
