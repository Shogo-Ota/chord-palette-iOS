/**
 * Degree-runtime QA: Identity and Transpose only.
 *
 * Teacher C|Am|F|G must replay as itself on the same progression, and as
 * teacher+2 on D|Bm|G|A. Pitch comes from degree + relativeOctave — never
 * from teacher absolutePitch at realize time.
 */

import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import { optimizeAttack } from '@/lib/performance/strictV2';
import type { ChordEvent } from '@/types';

import { realizeDegreePitch } from '../degreePitch';
import { realizeHumanTemplate } from '../realize';
import { normalizeHumanTemplate, type RawHumanTemplateJson } from '../types';
import { resolveAllowed } from '../../strictV2';

function ev(rootOffset: number, suffix: string): ChordEvent {
  return {
    id: `deg-${rootOffset}-${suffix || 'maj'}`,
    chordId: `deg-${rootOffset}-${suffix || 'maj'}`,
    rootOffset,
    suffix,
    displayName: suffix ? `${rootOffset}${suffix}` : String(rootOffset),
    degreeLabel: 'I',
    function: 'tonic',
    isPro: false,
    durationBeats: 4,
  };
}

/** Teacher take on C | Am | F | G — chord tones only, one attack per bar. */
const TEACHER_BARS: Array<{
  bar: number;
  symbol: string;
  rootPc: number;
  quality: string;
  intervals: number[];
  notes: Array<{
    chordRole: 'root' | 'third' | 'fifth';
    voicingPosition: 'lowest' | 'inner' | 'top';
    registerHint: 'low' | 'mid' | 'high';
    absolutePitch: number;
    durationBeats: number;
    relativeVelocity: number;
  }>;
}> = [
  {
    bar: 1,
    symbol: 'C',
    rootPc: 0,
    quality: 'maj',
    intervals: [0, 4, 7],
    notes: [
      { chordRole: 'root', voicingPosition: 'lowest', registerHint: 'low', absolutePitch: 36, durationBeats: 2, relativeVelocity: 0.8 },
      { chordRole: 'fifth', voicingPosition: 'inner', registerHint: 'low', absolutePitch: 43, durationBeats: 2, relativeVelocity: 0.7 },
      { chordRole: 'third', voicingPosition: 'inner', registerHint: 'mid', absolutePitch: 52, durationBeats: 2, relativeVelocity: 0.75 },
      { chordRole: 'root', voicingPosition: 'top', registerHint: 'high', absolutePitch: 60, durationBeats: 2, relativeVelocity: 0.85 },
    ],
  },
  {
    bar: 2,
    symbol: 'Am',
    rootPc: 9,
    quality: 'min',
    intervals: [0, 3, 7],
    notes: [
      { chordRole: 'root', voicingPosition: 'lowest', registerHint: 'low', absolutePitch: 45, durationBeats: 2, relativeVelocity: 0.8 },
      { chordRole: 'fifth', voicingPosition: 'inner', registerHint: 'low', absolutePitch: 52, durationBeats: 2, relativeVelocity: 0.7 },
      { chordRole: 'third', voicingPosition: 'inner', registerHint: 'mid', absolutePitch: 60, durationBeats: 2, relativeVelocity: 0.75 },
      { chordRole: 'fifth', voicingPosition: 'top', registerHint: 'high', absolutePitch: 64, durationBeats: 2, relativeVelocity: 0.85 },
    ],
  },
  {
    bar: 3,
    symbol: 'F',
    rootPc: 5,
    quality: 'maj',
    intervals: [0, 4, 7],
    notes: [
      { chordRole: 'root', voicingPosition: 'lowest', registerHint: 'low', absolutePitch: 41, durationBeats: 2, relativeVelocity: 0.8 },
      { chordRole: 'fifth', voicingPosition: 'inner', registerHint: 'low', absolutePitch: 48, durationBeats: 2, relativeVelocity: 0.7 },
      { chordRole: 'third', voicingPosition: 'inner', registerHint: 'mid', absolutePitch: 57, durationBeats: 2, relativeVelocity: 0.75 },
      { chordRole: 'root', voicingPosition: 'top', registerHint: 'high', absolutePitch: 65, durationBeats: 2, relativeVelocity: 0.85 },
    ],
  },
  {
    bar: 4,
    symbol: 'G',
    rootPc: 7,
    quality: 'maj',
    intervals: [0, 4, 7],
    notes: [
      { chordRole: 'root', voicingPosition: 'lowest', registerHint: 'low', absolutePitch: 43, durationBeats: 2, relativeVelocity: 0.8 },
      { chordRole: 'fifth', voicingPosition: 'inner', registerHint: 'low', absolutePitch: 50, durationBeats: 2, relativeVelocity: 0.7 },
      { chordRole: 'third', voicingPosition: 'inner', registerHint: 'mid', absolutePitch: 59, durationBeats: 2, relativeVelocity: 0.75 },
      { chordRole: 'root', voicingPosition: 'top', registerHint: 'high', absolutePitch: 67, durationBeats: 2, relativeVelocity: 0.85 },
    ],
  },
];

function teacherPitches(): number[] {
  return TEACHER_BARS.flatMap((bar) => bar.notes.map((n) => n.absolutePitch));
}

function teacherTemplate(): ReturnType<typeof normalizeHumanTemplate> {
  const raw: RawHumanTemplateJson = {
    id: 'qa.identity.C-Am-F-G',
    sourceId: 'QA_C_AM_F_G',
    meter: { beatsPerBar: 4, beatUnit: 4 },
    timeline: { loopBars: 4 },
    sourceChords: {
      loop: TEACHER_BARS.map((bar) => ({
        musicalBarInLoop: bar.bar,
        symbol: bar.symbol,
        rootPc: bar.rootPc,
        quality: bar.quality,
        chordIntervals: bar.intervals,
      })),
    },
    attacks: TEACHER_BARS.map((bar) => ({
      musicalBarInLoop: bar.bar,
      beatInMusicalBar: 0,
      notes: bar.notes,
    })),
  };
  return normalizeHumanTemplate(raw, 'normal');
}

function pitchSeq(events: { timeBeat: number; pitch: number }[]): number[] {
  return [...events]
    .sort((a, b) => a.timeBeat - b.timeBeat || a.pitch - b.pitch)
    .map((e) => e.pitch);
}

function contour(pitches: number[]): number[] {
  if (pitches.length === 0) return [];
  const bass = pitches[0]!;
  return pitches.map((p) => p - bass);
}

describe('Human MIDI Template — degree runtime Identity / Transpose', () => {
  const template = teacherTemplate();
  const identityChords = progressionToPerfChords(
    [ev(0, ''), ev(9, 'm'), ev(5, ''), ev(7, '')],
    'C',
  );
  const transposeChords = progressionToPerfChords(
    [ev(2, ''), ev(11, 'm'), ev(7, ''), ev(9, '')],
    'C',
  );

  it('Identity: Teacher C|Am|F|G → User C|Am|F|G keeps the teacher voice structure', () => {
    const events = realizeHumanTemplate(template, identityChords, {
      seed: 1,
      velocityCenter: 80,
      pitchMode: 'teacherFidelity',
    });
    const expected = teacherPitches();
    expect(events).toHaveLength(expected.length);
    expect(pitchSeq(events)).toEqual(expected);
    expect(contour(pitchSeq(events))).toEqual(contour(expected));
  });

  it('Transpose: Teacher C|Am|F|G → User D|Bm|G|A is teacher +2 semitones', () => {
    const events = realizeHumanTemplate(template, transposeChords, {
      seed: 1,
      velocityCenter: 80,
      pitchMode: 'teacherFidelity',
    });
    const expected = teacherPitches().map((p) => p + 2);
    expect(events).toHaveLength(expected.length);
    expect(pitchSeq(events)).toEqual(expected);
    expect(contour(pitchSeq(events))).toEqual(contour(expected));
  });

  it('keeps onset order and note count per bar', () => {
    const identity = realizeHumanTemplate(template, identityChords, { seed: 1 });
    const transposed = realizeHumanTemplate(template, transposeChords, { seed: 1 });
    expect(identity.map((e) => e.timeBeat)).toEqual(transposed.map((e) => e.timeBeat));
    for (let bar = 0; bar < 4; bar++) {
      const start = bar * 4;
      const inBar = (e: { timeBeat: number }) => e.timeBeat >= start && e.timeBeat < start + 4;
      expect(identity.filter(inBar)).toHaveLength(4);
      expect(transposed.filter(inBar)).toHaveLength(4);
    }
  });

  it('does not let a mutated absolutePitch change realized pitch', () => {
    const note = template.attacks[0]!.notes[0]!;
    const allowed = resolveAllowed(identityChords[0]!.harmony!);
    const before = realizeDegreePitch(note, allowed);
    const poisoned = { ...note, absolutePitch: 91 };
    expect(realizeDegreePitch(poisoned, allowed)).toBe(before);
    expect(before).not.toBe(91);
  });

  it('voicingOptimizer no longer adopts teacher absolutePitch as the target', () => {
    const allowed = resolveAllowed({
      symbol: 'C',
      rootPc: 0,
      quality: 'maj',
      chordIntervals: [0, 4, 7],
    });
    const result = optimizeAttack(
      [
        { chordRole: 'fifth', voicingPosition: 'top', registerHint: 'high', absolutePitch: 91 },
      ],
      allowed,
      { prevPitches: null, prevBass: null, prevTop: null, prevChordPcs: null },
    );
    expect(result.pitches[0]).not.toBe(91);
    expect(allowed.containsPitch(result.pitches[0]!)).toBe(true);
  });
});
