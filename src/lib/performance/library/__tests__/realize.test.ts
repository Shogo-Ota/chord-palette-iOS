/**
 * Library realize + Ballad catalog + extract whitelist (accompaniment MIDI retarget).
 */

import {
  BALLAD_DEFAULT_LIBRARY_PATTERN_ID,
  BALLAD_PIANO_BROKEN_HOLD_V1,
  extractPatternSummary,
  libraryPatternById,
  realizeLibraryPattern,
  validateLibraryPattern,
} from '@/lib/performance/library';
import { generatePerformance, type PerfChord } from '@/lib/performance/PerformanceEngine';
import type { NoteEvent } from '@/lib/performance/NoteEvent';

function cgAmF(): PerfChord[] {
  const roots = [60, 67, 69, 65];
  return roots.map((root, bar) => ({
    bodyMidi: [root, root + 4, root + 7],
    bassMidi: [root - 24],
    arpMidi: [root, root + 4, root + 7, root + 11],
    startBeat: bar * 4,
    durationBeats: 4,
  }));
}

function fingerprint(events: NoteEvent[]): string {
  return events
    .map(
      (e) =>
        `${e.trackId}:${e.timeBeat.toFixed(4)}:${e.durationBeat.toFixed(4)}:${e.pitch}:${e.velocity}`,
    )
    .join('|');
}

describe('BALLAD_PIANO_BROKEN_HOLD_V1 catalog', () => {
  it('validates and exposes whitelist extract fields', () => {
    expect(validateLibraryPattern(BALLAD_PIANO_BROKEN_HOLD_V1)).toEqual([]);
    const summary = extractPatternSummary(BALLAD_PIANO_BROKEN_HOLD_V1);
    expect(summary.bpmRange.min).toBe(60);
    expect(summary.meter.beatsPerBar).toBe(4);
    expect(summary.patternLengthBeats).toBe(4);
    expect(summary.onsetCount).toBeGreaterThan(0);
    expect(summary.maxPolyphony).toBeGreaterThanOrEqual(2);
    expect(summary.chordToneRoles).toEqual([0, 1, 2]);
    expect(summary.hasPhraseVariation).toBe(true);
    expect(summary.progressionHints?.preferCommonTones).toBe(true);
    // Beat 1 has no onset in the body pattern → rest-by-absence.
    expect(summary.restBeats).toContain(1);
  });

  it('is registered under its id', () => {
    expect(libraryPatternById(BALLAD_DEFAULT_LIBRARY_PATTERN_ID)).toBe(BALLAD_PIANO_BROKEN_HOLD_V1);
  });
});

describe('realizeLibraryPattern', () => {
  it('is deterministic and uses only chord tones from arpMidi', () => {
    const chords = cgAmF();
    const a = realizeLibraryPattern(BALLAD_PIANO_BROKEN_HOLD_V1, chords, { seed: 42 });
    const b = realizeLibraryPattern(BALLAD_PIANO_BROKEN_HOLD_V1, chords, { seed: 42 });
    expect(fingerprint(a)).toBe(fingerprint(b));
    expect(a.length).toBeGreaterThan(0);
    expect(a.every((e) => e.trackId === 'chord')).toBe(true);

    for (const e of a) {
      const chord = chords.find(
        (c) => e.timeBeat >= c.startBeat - 1e-9 && e.timeBeat < c.startBeat + c.durationBeats - 1e-9,
      );
      expect(chord).toBeDefined();
      const pcs = new Set((chord!.arpMidi ?? chord!.bodyMidi).map((p) => p % 12));
      expect(pcs.has(e.pitch % 12)).toBe(true);
    }
  });

  it('applies phraseVariation on the fourth bar of the phrase', () => {
    const chords = cgAmF(); // 4 bars → bar index 3 uses phraseVariation
    const events = realizeLibraryPattern(BALLAD_PIANO_BROKEN_HOLD_V1, chords, { seed: 1 });
    const bar3 = events.filter((e) => e.timeBeat >= 12 && e.timeBeat < 16);
    const bar0 = events.filter((e) => e.timeBeat >= 0 && e.timeBeat < 4);
    // Variation has 3 notes; body has 4.
    expect(bar3.length).toBe(3);
    expect(bar0.length).toBe(4);
  });

  it('does not invent pitches outside the chord', () => {
    const chords: PerfChord[] = [
      {
        bodyMidi: [60, 64, 67],
        bassMidi: [36],
        arpMidi: [60, 64, 67],
        startBeat: 0,
        durationBeats: 4,
      },
    ];
    const events = realizeLibraryPattern(BALLAD_PIANO_BROKEN_HOLD_V1, chords, {
      seed: 9,
      velocityCenter: 80,
    });
    for (const e of events) {
      expect([0, 4, 7]).toContain(e.pitch % 12);
    }
  });
});

describe('generatePerformance × libraryPatternId (Ballad only)', () => {
  it('replaces chord track with realized pattern; drums/bass remain', () => {
    const withLib = generatePerformance(
      { chords: cgAmF(), bpm: 90, seed: 42 },
      {
        styleId: 'relaxed',
        accompanimentStyle: 'ballad',
        libraryPatternId: BALLAD_DEFAULT_LIBRARY_PATTERN_ID,
        drums: true,
        energy: 'build',
      },
    );
    const baseline = generatePerformance(
      { chords: cgAmF(), bpm: 90, seed: 42 },
      {
        styleId: 'relaxed',
        accompanimentStyle: 'ballad',
        drums: true,
        energy: 'build',
      },
    );

    expect(withLib.length).toBeGreaterThan(0);
    expect(fingerprint(withLib)).not.toBe(fingerprint(baseline));
    expect(withLib.some((e) => e.trackId === 'chord')).toBe(true);
    expect(withLib.some((e) => e.trackId === 'bass')).toBe(true);
    expect(withLib.some((e) => e.trackId === 'kick')).toBe(true);

    // Same seed ⇒ identical library take.
    const again = generatePerformance(
      { chords: cgAmF(), bpm: 90, seed: 42 },
      {
        styleId: 'relaxed',
        accompanimentStyle: 'ballad',
        libraryPatternId: BALLAD_DEFAULT_LIBRARY_PATTERN_ID,
        drums: true,
        energy: 'build',
      },
    );
    expect(fingerprint(withLib)).toBe(fingerprint(again));
  });

  it('ignores libraryPatternId for non-ballad styles', () => {
    const a = generatePerformance(
      { chords: cgAmF(), bpm: 90, seed: 7 },
      {
        styleId: 'driving',
        accompanimentStyle: 'band',
        libraryPatternId: BALLAD_DEFAULT_LIBRARY_PATTERN_ID,
        drums: false,
      },
    );
    const b = generatePerformance(
      { chords: cgAmF(), bpm: 90, seed: 7 },
      {
        styleId: 'driving',
        accompanimentStyle: 'band',
        drums: false,
      },
    );
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it('omitting libraryPatternId keeps migration-compatible Ballad build', () => {
    const a = generatePerformance(
      { chords: cgAmF(), bpm: 90, seed: 11 },
      { styleId: 'relaxed', accompanimentStyle: 'ballad', energy: 'build', drums: false },
    );
    const b = generatePerformance(
      { chords: cgAmF(), bpm: 90, seed: 11 },
      { styleId: 'relaxed', accompanimentStyle: 'ballad', drums: false },
    );
    expect(fingerprint(a)).toBe(fingerprint(b));
  });
});
