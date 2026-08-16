/**
 * Lossless teacher-tone compile for Human MIDI Templates.
 *
 * Identity (same chord as the teacher) must reconstruct the teacher MIDI pitch.
 * Notes inside the GT chord stay CHORD_TONE. Notes outside it stay CHROMATIC —
 * they are never relabeled as 7th/9th/11th/13th and never snapped to another degree.
 */

import type { ChordHarmonyInput, TemplateNote } from '../strictV2';

import type { ChordDegree } from './degreePitch';

export const TONE_KINDS = ['chordTone', 'chromatic'] as const;
export type ToneKind = (typeof TONE_KINDS)[number];

function wrapPc(n: number): number {
  return ((n % 12) + 12) % 12;
}

function shortestPcDelta(from: number, to: number): number {
  let d = wrapPc(from) - wrapPc(to);
  if (d > 6) d -= 12;
  if (d < -6) d += 12;
  return d;
}

function degreeFromChordInterval(interval: number): ChordDegree {
  const n = wrapPc(interval);
  if (n === 0) return 'root';
  if (n === 3 || n === 4) return 'third';
  if (n === 6 || n === 7 || n === 8) return 'fifth';
  if (n === 10 || n === 11) return 'seventh';
  return 'ninth';
}

/** Semitones from the 0–11 chord root up to the sounding MIDI note. */
export function intervalFromRoot(absolutePitch: number, rootPc: number): number {
  return absolutePitch - wrapPc(rootPc);
}

export function classifyTeacherTone(
  absolutePitch: number,
  source: ChordHarmonyInput,
): {
  toneKind: ToneKind;
  degree: ChordDegree;
  anchorDegree: ChordDegree;
  chromaticOffsetSemitones: number;
  intervalFromRoot: number;
  relativeOctave: number;
} {
  const fromRoot = intervalFromRoot(absolutePitch, source.rootPc);
  const actualPc = wrapPc(absolutePitch);
  const chordIvs = source.chordIntervals.map((iv) => wrapPc(iv));
  const pcIv = wrapPc(fromRoot);

  if (chordIvs.includes(pcIv)) {
    const degree = degreeFromChordInterval(pcIv);
    return {
      toneKind: 'chordTone',
      degree,
      anchorDegree: degree,
      chromaticOffsetSemitones: 0,
      intervalFromRoot: fromRoot,
      relativeOctave: Math.round((fromRoot - pcIv) / 12),
    };
  }

  let nearest = chordIvs[0] ?? 0;
  let best = 99;
  for (const iv of chordIvs) {
    const d = Math.abs(shortestPcDelta(actualPc, wrapPc(source.rootPc + iv)));
    if (d < best) {
      best = d;
      nearest = iv;
    }
  }
  const anchorDegree = degreeFromChordInterval(nearest);
  const expectedPc = wrapPc(source.rootPc + nearest);
  return {
    toneKind: 'chromatic',
    degree: anchorDegree,
    anchorDegree,
    chromaticOffsetSemitones: shortestPcDelta(actualPc, expectedPc),
    intervalFromRoot: fromRoot,
    relativeOctave: Math.round((fromRoot - nearest) / 12),
  };
}

export function teacherVelocity(note: TemplateNote): number {
  if (note.velocity !== undefined) {
    return Math.max(1, Math.min(127, Math.round(note.velocity)));
  }
  const ratio = note.relativeVelocity ?? 0.75;
  return Math.max(1, Math.min(127, Math.round(ratio * 127)));
}
