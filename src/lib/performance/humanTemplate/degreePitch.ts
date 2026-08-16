/**
 * Production pitch for Human MIDI Templates.
 *
 * Teacher `absolutePitch` is an ingest input. Compile turns it into
 * toneKind + intervalFromRoot (+ degree / chromatic offset). Runtime never
 * reads `absolutePitch`. Identity (same root as the teacher) reconstructs
 * the teacher pitch via `sourceRootPc + intervalFromRoot` (globalDelta = 0).
 * Pure Transpose adds one progression-level delta; it does not wrap per bar.
 *
 * Off-GT-chord teacher notes are CHROMATIC. They are not labeled 7th/9th/11th/13th
 * and are never snapped through MISSING_DEGREE_FALLBACK.
 */

import {
  foldPcToWindow,
  resolveAllowed,
  VOICE_REGISTERS,
  type AllowedToneSet,
  type ChordHarmonyInput,
  type TemplateNote,
} from '../strictV2';
import type { RegisterWindow } from '../strictV2/registerPolicy';
import { classifyTeacherTone } from './losslessTone';
import { applyGlobalTranspose } from './pureTranspose';

export const CHORD_DEGREES = ['root', 'third', 'fifth', 'seventh', 'ninth'] as const;
export type ChordDegree = (typeof CHORD_DEGREES)[number];

export const VOICE_ROLES = ['bass', 'inner', 'upper', 'top'] as const;
export type VoiceRole = (typeof VOICE_ROLES)[number];

const DEGREE_INTERVALS: Record<ChordDegree, readonly number[]> = {
  root: [0],
  third: [3, 4],
  fifth: [6, 7, 8],
  seventh: [10, 11],
  ninth: [1, 2, 13, 14],
};

const DEFAULT_INTERVAL: Record<ChordDegree, number> = {
  root: 0,
  third: 4,
  fifth: 7,
  seventh: 10,
  ninth: 2,
};

const MISSING_DEGREE_FALLBACK: Record<ChordDegree, readonly ChordDegree[]> = {
  root: ['root'],
  third: ['root'],
  fifth: ['root'],
  seventh: ['third', 'root'],
  ninth: ['third', 'root'],
};

const UPPER_WINDOW: RegisterWindow = { lo: 55, hi: 67, center: 60 };

const ROLE_WINDOW: Record<VoiceRole, RegisterWindow> = {
  bass: VOICE_REGISTERS.bass.preferred,
  inner: VOICE_REGISTERS.inner.preferred,
  upper: UPPER_WINDOW,
  top: VOICE_REGISTERS.top.preferred,
};

export function normalizeDegree(role: string | undefined): ChordDegree {
  switch (role) {
    case 'third':
      return 'third';
    case 'fifth':
      return 'fifth';
    case 'seventh':
      return 'seventh';
    case 'ninth':
    case 'eleventh':
    case 'thirteenth':
      return 'ninth';
    default:
      return 'root';
  }
}

export function voiceRoleFromLegacy(note: TemplateNote): VoiceRole {
  if (note.voiceRole === 'bass' || note.voiceRole === 'inner' || note.voiceRole === 'upper' || note.voiceRole === 'top') {
    return note.voiceRole;
  }
  const pos = note.voicingPosition ?? '';
  const hint = note.registerHint ?? '';
  if (pos === 'lowest') return 'bass';
  if (pos === 'top') return 'top';
  if (pos === 'upper') return 'upper';
  if (hint === 'high' && pos === 'inner') return 'upper';
  if (hint === 'high') return 'top';
  if (hint === 'low') return 'bass';
  return 'inner';
}

function wrapPc(n: number): number {
  return ((n % 12) + 12) % 12;
}

function spelledInterval(degree: ChordDegree, intervals: readonly number[]): number | null {
  const wanted = DEGREE_INTERVALS[degree];
  for (const iv of intervals) {
    const n = wrapPc(iv);
    if (wanted.includes(n) || wanted.includes(iv)) return n;
  }
  return null;
}

/**
 * Pitch class the user chord spells for this degree.
 * Missing extensions fall back to a chord tone — they are never invented.
 */
export function degreePitchClass(
  degree: ChordDegree,
  alteration: number,
  allowed: AllowedToneSet,
): number {
  const spelled = spelledInterval(degree, allowed.intervals);
  if (spelled !== null) {
    const withAlt = wrapPc(allowed.rootPc + spelled + alteration);
    if (allowed.containsPc(withAlt)) return withAlt;
    return wrapPc(allowed.rootPc + spelled);
  }
  for (const fallback of MISSING_DEGREE_FALLBACK[degree]) {
    const iv = spelledInterval(fallback, allowed.intervals);
    if (iv !== null) return wrapPc(allowed.rootPc + iv);
  }
  return allowed.rootPc;
}

/** Octaves above a chord root for `rootPc + interval + 12 * oct`. */
export function relativeOctaveFromRoot(
  absolutePitch: number,
  rootPc: number,
  degreeInterval: number,
  alteration: number,
): number {
  return Math.round((absolutePitch - wrapPc(rootPc) - degreeInterval - alteration) / 12);
}

/** Fallback when the source chord is unknown: MIDI octave of the sounding PC. */
export function relativeOctaveFromAbsolute(absolutePitch: number, pc: number): number {
  return Math.round((absolutePitch - wrapPc(pc)) / 12);
}

function spelledDegreeInterval(degree: ChordDegree, alteration: number, allowed: AllowedToneSet): number {
  const spelled = spelledInterval(degree, allowed.intervals);
  if (spelled !== null) return spelled + alteration;
  return DEFAULT_INTERVAL[degree] + alteration;
}

export function compileProductionNote(
  note: TemplateNote,
  source: ChordHarmonyInput | undefined,
  attackGroup = 0,
): TemplateNote {
  const voiceRole = voiceRoleFromLegacy(note);
  let degree = normalizeDegree(note.degree ?? note.chordRole);
  let alteration = note.alteration ?? 0;
  let relativeOctave = note.relativeOctave;
  let toneKind = note.toneKind;
  let interval = note.intervalFromRoot;
  let anchorDegree = note.anchorDegree;
  let chromaticOffset = note.chromaticOffsetSemitones ?? 0;

  if (note.absolutePitch !== undefined) {
    const actualPc = wrapPc(note.absolutePitch);
    if (source) {
      const classified = classifyTeacherTone(note.absolutePitch, source);
      toneKind = classified.toneKind;
      degree = classified.degree;
      anchorDegree = classified.anchorDegree;
      chromaticOffset = classified.chromaticOffsetSemitones;
      interval = classified.intervalFromRoot;
      relativeOctave = classified.relativeOctave;
      alteration = classified.chromaticOffsetSemitones;
    } else {
      interval = note.absolutePitch - actualPc;
      relativeOctave = relativeOctaveFromAbsolute(note.absolutePitch, actualPc);
      toneKind = 'chordTone';
    }
  }

  return {
    ...note,
    degree,
    chordRole: degree,
    alteration,
    voiceRole,
    relativeOctave: relativeOctave ?? 5,
    toneKind,
    intervalFromRoot: interval,
    sourceRootPc: source ? wrapPc(source.rootPc) : note.sourceRootPc,
    anchorDegree,
    chromaticOffsetSemitones: chromaticOffset,
    attackGroup: note.attackGroup ?? attackGroup,
  };
}

export function compileProductionNotes(
  notes: readonly TemplateNote[],
  source: ChordHarmonyInput | undefined,
  attackGroup = 0,
): TemplateNote[] {
  return notes.map((note) => compileProductionNote(note, source, attackGroup));
}

/**
 * Runtime final pitch. Does not read `absolutePitch`.
 * When `globalDelta` is known, every note moves by that one interval.
 */
export function realizeDegreePitch(
  note: TemplateNote,
  allowed: AllowedToneSet,
  globalDelta?: number,
): number {
  if (
    note.intervalFromRoot !== undefined &&
    note.sourceRootPc !== undefined &&
    globalDelta !== undefined
  ) {
    return clampMidi(applyGlobalTranspose(note.sourceRootPc, note.intervalFromRoot, globalDelta));
  }
  if (note.intervalFromRoot !== undefined) {
    return clampMidi(allowed.rootPc + note.intervalFromRoot);
  }
  const degree = normalizeDegree(note.degree ?? note.chordRole);
  const alteration = note.alteration ?? 0;
  if (note.relativeOctave !== undefined) {
    const interval = spelledDegreeInterval(degree, alteration, allowed);
    return clampMidi(allowed.rootPc + interval + 12 * note.relativeOctave);
  }
  const pc = degreePitchClass(degree, alteration, allowed);
  const role = voiceRoleFromLegacy(note);
  return foldPcToWindow(pc, ROLE_WINDOW[role]);
}

function clampMidi(n: number): number {
  return Math.max(0, Math.min(127, Math.round(n)));
}
