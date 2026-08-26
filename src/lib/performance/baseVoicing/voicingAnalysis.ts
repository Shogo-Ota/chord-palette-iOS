/**
 * Observation-only voicing metrics. This module never scores or selects
 * candidates — it describes a finished voicing so experiments can dump
 * before/after JSON without depending on Style.
 */

import { classifyInterval, wrapPc, type HarmonicDegree } from '../humanTemplate/degreeRoles';
import type { ChordHarmonyInput } from '../strictV2';
import { buildCompactBaseVoicings, compactCandidatesForHarmony } from './CompactVoicingEngine';
import { baseVoicingTransitionCost } from './continuity';
import { activeVoicingPolicy } from './policy/registry';
import type { VoicingPolicySpec } from './policy/types';
import type { BaseVoicing, BaseVoicingNote, BaseVoicingPreference, VoicingPosition } from './types';

const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export function midiToNoteName(pitch: number): string {
  return `${NOTE_NAMES[wrapPc(pitch)]}${Math.floor(pitch / 12) - 1}`;
}

export function adjacentIntervals(pitches: readonly number[]): number[] {
  const ordered = [...pitches].sort((left, right) => left - right);
  const intervals: number[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    intervals.push(ordered[index]! - ordered[index - 1]!);
  }
  return intervals;
}

export function hasRhSemitonePair(
  notes: readonly BaseVoicingNote[],
  pcA: number,
  pcB: number,
): boolean {
  const right = notes
    .filter((note) => note.hand === 'RH')
    .sort((left, rightNote) => left.pitch - rightNote.pitch);
  for (let index = 0; index < right.length - 1; index += 1) {
    const low = right[index]!;
    const high = right[index + 1]!;
    if (high.pitch - low.pitch !== 1) continue;
    const pcs = new Set([wrapPc(low.pc), wrapPc(high.pc)]);
    if (pcs.has(wrapPc(pcA)) && pcs.has(wrapPc(pcB))) return true;
  }
  return false;
}

export type VoicingNoteDump = {
  midi: number;
  name: string;
  pc: number;
  degree: HarmonicDegree;
  hand: BaseVoicingNote['hand'];
  interval: number;
};

export type VoicingQualityMetrics = {
  minorSecondCount: number;
  majorSecondCount: number;
  lowMinorSecondCount: number;
  clusterDensity: number;
  bassRootDuplication: boolean;
  lowestTensionPitch: number | null;
  rhHasEFAdjacency: boolean;
  rhHasCDbAdjacency: boolean;
};

export type SelectedVoicingDump = {
  chordSymbol: string;
  position: VoicingPosition;
  octaveShift: number;
  bassMidi: number;
  rhMidi: number[];
  notes: VoicingNoteDump[];
  adjacentIntervals: number[];
  rhAdjacentIntervals: number[];
  totalSpan: number;
  rhSpan: number;
  staticCost: number;
  continuityCost: number;
  selectedCandidateRank: number;
  candidateCount: number;
  metrics: VoicingQualityMetrics;
};

const LOW_MINOR_SECOND_CEILING = 55;

function rightHand(notes: readonly BaseVoicingNote[]): BaseVoicingNote[] {
  return notes.filter((note) => note.hand === 'RH').sort((left, right) => left.pitch - right.pitch);
}

function pitchSignature(notes: readonly BaseVoicingNote[]): string {
  return notes
    .map((note) => `${note.hand}:${note.pitch}`)
    .sort()
    .join('|');
}

export function voicingQualityMetrics(notes: readonly BaseVoicingNote[]): VoicingQualityMetrics {
  const right = rightHand(notes);
  const rhIntervals = adjacentIntervals(right.map((note) => note.pitch));
  const minorSeconds = right.filter((_, index) => rhIntervals[index] === 1);
  const bass = notes.find((note) => note.hand === 'LH');
  const tensions = notes.filter(
    (note) => note.degree === 'ninth' || note.degree === 'eleventh' || note.degree === 'thirteenth',
  );
  const rhSpan = right.length ? right[right.length - 1]!.pitch - right[0]!.pitch : 0;

  return {
    minorSecondCount: rhIntervals.filter((interval) => interval === 1).length,
    majorSecondCount: rhIntervals.filter((interval) => interval === 2).length,
    lowMinorSecondCount: minorSeconds.filter((note) => note.pitch < LOW_MINOR_SECOND_CEILING)
      .length,
    clusterDensity: right.length === 0 ? 0 : right.length / Math.max(rhSpan, 1),
    bassRootDuplication: Boolean(
      bass &&
      classifyInterval(bass.interval) === 'root' &&
      right.some((note) => wrapPc(note.pc) === wrapPc(bass.pc)),
    ),
    lowestTensionPitch: tensions.length ? Math.min(...tensions.map((note) => note.pitch)) : null,
    rhHasEFAdjacency: hasRhSemitonePair(notes, 4, 5),
    rhHasCDbAdjacency: hasRhSemitonePair(notes, 0, 1),
  };
}

export function dumpSelectedVoicing(
  voicing: BaseVoicing,
  continuityCost: number,
  policy: VoicingPolicySpec = activeVoicingPolicy(),
): SelectedVoicingDump {
  const candidates = compactCandidatesForHarmony(voicing.harmony, voicing.preference, policy);
  const selectedKey = pitchSignature(voicing.notes);
  const selectedIndex = candidates.findIndex(
    (candidate) => pitchSignature(candidate.notes) === selectedKey,
  );
  const left = voicing.notes.find((note) => note.hand === 'LH')!;
  const right = rightHand(voicing.notes);
  const allPitches = voicing.notes.map((note) => note.pitch);
  const matched = selectedIndex >= 0 ? candidates[selectedIndex] : undefined;

  return {
    chordSymbol: voicing.harmony.symbol,
    position: voicing.preference.position,
    octaveShift: voicing.preference.octaveShift,
    bassMidi: left.pitch,
    rhMidi: right.map((note) => note.pitch),
    notes: voicing.notes
      .slice()
      .sort((a, b) => a.pitch - b.pitch)
      .map((note) => ({
        midi: note.pitch,
        name: midiToNoteName(note.pitch),
        pc: note.pc,
        degree: note.degree,
        hand: note.hand,
        interval: note.interval,
      })),
    adjacentIntervals: adjacentIntervals(allPitches),
    rhAdjacentIntervals: adjacentIntervals(right.map((note) => note.pitch)),
    totalSpan: Math.max(...allPitches) - Math.min(...allPitches),
    rhSpan: right.length ? right[right.length - 1]!.pitch - right[0]!.pitch : 0,
    staticCost: matched?.staticCost ?? Number.NaN,
    continuityCost,
    selectedCandidateRank: selectedIndex + 1,
    candidateCount: candidates.length,
    metrics: voicingQualityMetrics(voicing.notes),
  };
}

export function dumpProgressionVoicings(
  harmonies: readonly ChordHarmonyInput[],
  preference: BaseVoicingPreference,
  policy: VoicingPolicySpec = activeVoicingPolicy(),
): SelectedVoicingDump[] {
  const voicings = buildCompactBaseVoicings(harmonies, preference, policy);
  const closed = [...voicings, voicings[0]!];
  return voicings.map((voicing, index) => {
    const previous = closed[index]!;
    const next = closed[index + 1]!;
    const incoming =
      voicings.length > 1 ? baseVoicingTransitionCost(previous.notes, voicing.notes) : 0;
    const outgoing = voicings.length > 1 ? baseVoicingTransitionCost(voicing.notes, next.notes) : 0;
    return dumpSelectedVoicing(voicing, incoming + outgoing, policy);
  });
}

export function measureCandidateGeneration(
  harmony: ChordHarmonyInput,
  preference: BaseVoicingPreference,
  policy: VoicingPolicySpec = activeVoicingPolicy(),
): { candidateCount: number; generationMs: number } {
  const started = process.hrtime.bigint();
  const candidates = compactCandidatesForHarmony(harmony, preference, policy);
  const generationMs = Number(process.hrtime.bigint() - started) / 1e6;
  return { candidateCount: candidates.length, generationMs };
}
