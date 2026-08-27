/**
 * The contract's own test list, plus the cases that prove a verdict is decided on
 * MIDI distance rather than on interval class.
 */

import { validateHarmonyCollisions } from '../HarmonyCollisionValidator';
import { harmonyCollisionChordFor } from '../chordContext';
import { formatHarmonyCollision } from '../debugLog';
import { mergeDuplicateNotes } from '../duplicateNotePolicy';
import { PIANO_COLLISION_PROFILE, shiftProfile } from '../instrumentProfiles';
import { evaluateIntervalPair } from '../intervalRules';
import type { HarmonyCollisionRuleId } from '../types';
import type { NoteEvent } from '../../NoteEvent';
import type { PerfChord } from '../../PerformanceEngine';

const QUALITIES: Record<string, { rootPc: number; intervals: number[] }> = {
  C: { rootPc: 0, intervals: [0, 4, 7] },
  Cmaj7: { rootPc: 0, intervals: [0, 4, 7, 11] },
  Cadd9: { rootPc: 0, intervals: [0, 4, 7, 14] },
  'C7(♭9)': { rootPc: 0, intervals: [0, 4, 7, 10, 13] },
  Fmaj7: { rootPc: 5, intervals: [0, 4, 7, 11] },
  G7: { rootPc: 7, intervals: [0, 4, 7, 10] },
  'G7(♭9)': { rootPc: 7, intervals: [0, 4, 7, 10, 13] },
  Cdim7: { rootPc: 0, intervals: [0, 3, 6, 9] },
  Bm7b5: { rootPc: 11, intervals: [0, 3, 6, 10] },
};

function chord(symbol: string, pitches: readonly number[] = []): PerfChord {
  const spec = QUALITIES[symbol]!;
  return {
    bodyMidi: [...pitches],
    bassMidi: [],
    harmony: {
      symbol,
      rootPc: spec.rootPc,
      quality: 'test',
      chordIntervals: spec.intervals,
    },
    startBeat: 0,
    durationBeats: 4,
  };
}

/** All pitches held for the whole bar, so every pair overlaps. */
function held(pitches: readonly number[]): NoteEvent[] {
  return pitches.map((pitch) => ({
    timeBeat: 0,
    durationBeat: 4,
    pitch,
    velocity: 80,
    articulation: 'normal' as const,
    rrIndex: 0,
    trackId: 'chord' as const,
    seed: 1,
  }));
}

function verdict(symbol: string, pitches: readonly number[]) {
  const report = validateHarmonyCollisions(held(pitches), [chord(symbol, pitches)], {
    styleId: 'test',
  });
  return {
    ok: report.ok,
    rules: report.rejects.map((reject) => reject.ruleId),
    report,
  };
}

function pairVerdict(symbol: string, lower: number, upper: number) {
  return evaluateIntervalPair(
    lower,
    upper,
    harmonyCollisionChordFor(chord(symbol)),
    PIANO_COLLISION_PROFILE,
  );
}

describe('HarmonyCollisionValidator — contract test list', () => {
  it('passes a spread Cmaj7', () => {
    expect(verdict('Cmaj7', [60, 64, 67, 71])).toMatchObject({ ok: true, rules: [] });
  });

  it('rejects B3 + C4 as a minor second', () => {
    expect(verdict('Cmaj7', [59, 60])).toMatchObject({
      ok: false,
      rules: ['MINOR_SECOND'],
    });
  });

  it('passes a spread Fmaj7', () => {
    expect(verdict('Fmaj7', [53, 57, 60, 64])).toMatchObject({ ok: true, rules: [] });
  });

  it('rejects an F#4 the Fmaj7 symbol never named', () => {
    const got = verdict('Fmaj7', [53, 57, 60, 66]);
    expect(got.ok).toBe(false);
    expect(got.rules).toContain('NON_CHORD_TONE');
  });

  it('passes a spread G7', () => {
    expect(verdict('G7', [55, 59, 62, 65])).toMatchObject({ ok: true, rules: [] });
  });

  it('accepts the B3 + F4 tritone inside G7', () => {
    expect(pairVerdict('G7', 59, 65)).toEqual({
      ruleId: 'TRITONE',
      result: 'ALLOW',
      reason: expect.any(String),
    });
    expect(verdict('G7', [59, 65])).toMatchObject({ ok: true });
  });

  it('rejects C3 + Db4 as a minor ninth the symbol never asked for', () => {
    const got = validateHarmonyCollisions(held([48, 61]), [chord('C', [48, 61])]);
    expect(got.ok).toBe(false);
    expect(got.rejects.map((reject) => reject.ruleId)).toContain('MINOR_NINTH');
  });

  it('admits the minor ninth a ♭9 symbol declares', () => {
    expect(pairVerdict('G7(♭9)', 55, 68)).toMatchObject({
      ruleId: 'MINOR_NINTH',
      result: 'ALLOW',
    });
    expect(verdict('G7(♭9)', [55, 59, 62, 65, 68])).toMatchObject({ ok: true });
  });

  it('rejects C2 + E2 on the low interval limit', () => {
    expect(verdict('C', [36, 40])).toMatchObject({
      ok: false,
      rules: ['LOW_INTERVAL_LIMIT'],
    });
  });

  it('passes C2 + G2', () => {
    expect(verdict('C', [36, 43])).toMatchObject({ ok: true, rules: [] });
  });

  it('passes C2 + C3', () => {
    expect(verdict('C', [36, 48])).toMatchObject({ ok: true, rules: [] });
  });
});

describe('a verdict reads MIDI distance, not interval class', () => {
  it('splits the same two pitch classes by their sounding distance', () => {
    // B and C: a semitone apart is mud, an octave and a semitone apart is a maj7.
    expect(pairVerdict('Cmaj7', 59, 60)).toMatchObject({
      ruleId: 'MINOR_SECOND',
      result: 'REJECT',
    });
    expect(pairVerdict('Cmaj7', 60, 71)).toMatchObject({
      ruleId: 'MAJOR_SEVENTH',
      result: 'ALLOW',
    });
  });

  it('splits C and Db by register into a minor second and a minor ninth', () => {
    expect(pairVerdict('C', 60, 61)?.ruleId).toBe('MINOR_SECOND');
    expect(pairVerdict('C', 48, 61)?.ruleId).toBe('MINOR_NINTH');
  });

  it('treats an octave as consonant at any register', () => {
    expect(pairVerdict('C', 36, 48)).toMatchObject({ ruleId: 'OCTAVE', result: 'ALLOW' });
    expect(pairVerdict('C', 72, 84)).toMatchObject({ ruleId: 'OCTAVE', result: 'ALLOW' });
  });
});

describe('major second is conditional on register and symbol', () => {
  it('allows a major second at or above the floor', () => {
    expect(pairVerdict('C', 60, 62)).toMatchObject({ ruleId: 'MAJOR_SECOND', result: 'ALLOW' });
  });

  it('rejects a major second below the floor when the symbol names no 9th', () => {
    expect(pairVerdict('C', 55, 57)).toMatchObject({ ruleId: 'MAJOR_SECOND', result: 'REJECT' });
  });

  it('allows the same pair when the symbol names an add9', () => {
    expect(pairVerdict('Cadd9', 55, 57)).toMatchObject({
      ruleId: 'MAJOR_SECOND',
      result: 'ALLOW',
    });
  });
});

describe('rule order', () => {
  it('reports the low interval limit before the minor second', () => {
    // A semitone in the bottom octave breaks both; the contract fixes which is named.
    expect(pairVerdict('C', 35, 36)?.ruleId).toBe('LOW_INTERVAL_LIMIT');
    expect(pairVerdict('C', 59, 60)?.ruleId).toBe('MINOR_SECOND');
  });

  it('skips the low interval limit for octaves and unisons', () => {
    expect(pairVerdict('C', 24, 36)).toMatchObject({ ruleId: 'OCTAVE', result: 'ALLOW' });
    expect(pairVerdict('C', 24, 24)).toMatchObject({ ruleId: 'DUPLICATE_NOTE', result: 'MERGE' });
  });
});

describe('overlap, not shared onset, decides what collides', () => {
  const notes: NoteEvent[] = [
    {
      timeBeat: 0,
      durationBeat: 4,
      pitch: 59,
      velocity: 80,
      articulation: 'normal',
      rrIndex: 0,
      trackId: 'chord',
      seed: 1,
    },
    {
      timeBeat: 2,
      durationBeat: 2,
      pitch: 60,
      velocity: 80,
      articulation: 'normal',
      rrIndex: 0,
      trackId: 'chord',
      seed: 1,
    },
  ];

  it('catches a semitone struck against a still-ringing note', () => {
    const report = validateHarmonyCollisions(notes, [chord('Cmaj7')]);
    expect(report.ok).toBe(false);
    expect(report.rejects[0]!.ruleId).toBe('MINOR_SECOND');
  });

  it('clears the same two pitches once the first has released', () => {
    const released = [{ ...notes[0]!, durationBeat: 2 }, notes[1]!];
    expect(validateHarmonyCollisions(released, [chord('Cmaj7')]).ok).toBe(true);
  });

  it('leaves drum voices alone', () => {
    const drums = notes.map((note) => ({ ...note, trackId: 'kick' as const }));
    const report = validateHarmonyCollisions(drums, [chord('Cmaj7')]);
    expect(report.examined).toBe(0);
    expect(report.ok).toBe(true);
  });
});

describe('duplicate notes', () => {
  it('reports a merge rather than a harmonic error', () => {
    const report = validateHarmonyCollisions(held([60, 60]), [chord('C', [60])]);
    expect(report.countsByRule.DUPLICATE_NOTE).toBe(1);
    expect(report.ok).toBe(true);
  });

  it('leaves a re-articulation over a ringing note alone', () => {
    // Same pitch, still sounding, struck again two beats later: the rhythm asked for
    // this attack, so it is not the duplicate note-on the contract names.
    const rearticulated: NoteEvent[] = [
      { ...held([60])[0]!, durationBeat: 4 },
      { ...held([60])[0]!, timeBeat: 2, durationBeat: 2 },
    ];
    const report = validateHarmonyCollisions(rearticulated, [chord('C', [60])]);
    expect(report.countsByRule.DUPLICATE_NOTE ?? 0).toBe(0);
    expect(report.ok).toBe(true);
  });

  it('merges to one note keeping the longer span and louder velocity', () => {
    const doubled: NoteEvent[] = [
      { ...held([60])[0]!, velocity: 60, durationBeat: 1 },
      { ...held([60])[0]!, velocity: 96, durationBeat: 3 },
    ];
    const merged = mergeDuplicateNotes(doubled);
    expect(merged.merged).toBe(1);
    expect(merged.notes).toHaveLength(1);
    expect(merged.notes[0]).toMatchObject({ velocity: 96, durationBeat: 3 });
  });
});

describe('instrument range and octave shift', () => {
  it('rejects a pitch below the instrument', () => {
    const report = validateHarmonyCollisions(held([12]), [chord('C', [12])]);
    expect(report.rejects.map((reject) => reject.ruleId)).toContain('INSTRUMENT_RANGE');
  });

  it('moves the register windows with the octave shift', () => {
    const shifted = shiftProfile(PIANO_COLLISION_PROFILE, -1);
    // C2 + E2 breaks the unshifted limit; an octave down it breaks the shifted one.
    expect(
      evaluateIntervalPair(24, 28, harmonyCollisionChordFor(chord('C')), shifted),
    ).toMatchObject({ ruleId: 'LOW_INTERVAL_LIMIT', result: 'REJECT' });
    expect(shifted.majorSecondFloor).toBe(48);
  });
});

describe('modes are the only way past a rule', () => {
  it('admits a close minor second in cluster mode', () => {
    const report = validateHarmonyCollisions(held([59, 60]), [chord('Cmaj7', [59, 60])], {
      mode: 'cluster',
    });
    expect(report.ok).toBe(true);
  });

  it('skips chord membership in ornament mode', () => {
    const report = validateHarmonyCollisions(held([53, 57, 60, 66]), [chord('Fmaj7')], {
      mode: 'ornament',
    });
    expect(report.rejects.map((reject) => reject.ruleId)).not.toContain('NON_CHORD_TONE');
  });
});

describe('debug log', () => {
  it('records every field the contract requires', () => {
    const report = validateHarmonyCollisions(held([64, 65]), [chord('Fmaj7', [64, 65])], {
      styleId: 'block.type1',
      beatsPerBar: 4,
    });
    const record = report.rejects.find((reject) => reject.ruleId === 'MINOR_SECOND')!;
    expect(record).toMatchObject({
      chordSymbol: 'Fmaj7',
      chordRoot: 5,
      noteA: 'E4',
      noteB: 'F4',
      midiA: 64,
      midiB: 65,
      intervalSemitones: 1,
      lowerNote: 64,
      styleId: 'block.type1',
      barIndex: 0,
      beatPosition: 0,
      result: 'REJECT',
    });
    expect(record.allowedPitchClasses).toEqual([0, 4, 5, 9]);
    const text = formatHarmonyCollision(record);
    expect(text).toContain('[HarmonyCollision]');
    expect(text).toContain('Chord: Fmaj7');
    expect(text).toContain('Allowed: C E F A');
    expect(text).toContain('Notes: E4 / F4');
    expect(text).toContain('MIDI: 64 / 65');
    expect(text).toContain('Interval: 1');
    expect(text).toContain('Rule: MINOR_SECOND');
    expect(text).toContain('Result: REJECT');
  });
});

describe('chord membership never invents an extension', () => {
  it('admits only the tones the symbol spells', () => {
    expect(harmonyCollisionChordFor(chord('Fmaj7')).allowedPitchClasses).toEqual([0, 4, 5, 9]);
    expect(harmonyCollisionChordFor(chord('Cadd9')).allowedPitchClasses).toEqual([0, 2, 4, 7]);
    expect(harmonyCollisionChordFor(chord('Cdim7')).allowedPitchClasses).toEqual([0, 3, 6, 9]);
  });

  it('reads the ninth and the ♭9 off the symbol, not off the register', () => {
    expect(harmonyCollisionChordFor(chord('C')).carriesNinth).toBe(false);
    expect(harmonyCollisionChordFor(chord('Cadd9')).carriesNinth).toBe(true);
    expect(harmonyCollisionChordFor(chord('C7(♭9)')).flatNinthPcs).toEqual([1]);
    expect(harmonyCollisionChordFor(chord('Cadd9')).flatNinthPcs).toEqual([]);
  });
});

describe('chord definitions that need their dissonance', () => {
  const cases: [string, number[], HarmonyCollisionRuleId | null][] = [
    ['Cdim7', [60, 66], 'TRITONE'],
    ['Bm7b5', [59, 65], 'TRITONE'],
    ['G7', [59, 65], 'TRITONE'],
  ];
  it.each(cases)('allows the %s tritone', (symbol, [lower, upper], ruleId) => {
    expect(pairVerdict(symbol, lower!, upper!)).toMatchObject({ ruleId, result: 'ALLOW' });
  });
});
