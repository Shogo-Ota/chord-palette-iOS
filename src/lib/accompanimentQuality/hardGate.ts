/**
 * Hard contracts. Fail here and the candidate never reaches a preference score.
 * Playback pitch / CC64 are runtime gates — this module checks the MIDI voicing.
 */

import type { FinalMidiSnapshot } from '@/lib/performance/finalMidi/types';

import { intervalsForQuality, wrapPc } from './pop909Chords';
import type { PopChordSpan } from './types';
import { uniqueSorted } from './popVoicingFeatures';
import { assignVoices } from './voiceAssign';

export type HardGateResult = {
  ok: boolean;
  errors: string[];
};

export function allowedPitchClasses(
  chord: Pick<PopChordSpan, 'rootPc' | 'quality' | 'bassPc'>,
): number[] {
  const pcs = new Set(intervalsForQuality(chord.quality, chord.rootPc));
  pcs.add(wrapPc(chord.bassPc));
  return [...pcs];
}

export function gateVoicing(
  pitches: readonly number[],
  chord: Pick<PopChordSpan, 'rootPc' | 'quality' | 'bassPc' | 'symbol'>,
): HardGateResult {
  const errors: string[] = [];
  const unique = uniqueSorted(pitches);
  if (unique.length !== pitches.length) errors.push(`${chord.symbol}: identical MIDI duplicate`);
  const allowed = new Set(allowedPitchClasses(chord));
  for (const p of unique) {
    if (!allowed.has(wrapPc(p))) errors.push(`${chord.symbol}: illegal PC ${p}`);
  }
  const explicitSlash = wrapPc(chord.bassPc) !== wrapPc(chord.rootPc);
  if (explicitSlash && unique.length && wrapPc(unique[0]) !== wrapPc(chord.bassPc)) {
    errors.push(`${chord.symbol}: slash bass contract wants PC ${chord.bassPc}, got ${unique[0]}`);
  }
  return { ok: errors.length === 0, errors };
}

export function gateCandidate(
  voicings: readonly number[][],
  chords: readonly Pick<PopChordSpan, 'rootPc' | 'quality' | 'bassPc' | 'symbol'>[],
): HardGateResult {
  const errors: string[] = [];
  if (voicings.length !== chords.length) {
    return { ok: false, errors: ['voicing count != chord count'] };
  }
  voicings.forEach((v, i) => {
    const g = gateVoicing(v, chords[i]);
    errors.push(...g.errors);
  });
  for (let i = 1; i < voicings.length; i += 1) {
    const assigned = assignVoices(uniqueSorted(voicings[i - 1]), uniqueSorted(voicings[i]));
    if (assigned.crossingCount > 0) {
      errors.push(`transition ${i}: voice crossing ${assigned.crossingCount}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Offline stand-in for playback pitch / CC64 contracts. Device engines stay out of this module. */
export function gateOfflineSnapshot(snapshot: FinalMidiSnapshot): HardGateResult {
  const errors: string[] = [];
  for (const n of snapshot.notes) {
    if (n.pitch < 0 || n.pitch > 127) errors.push(`pitch ${n.pitch} outside 0–127`);
  }
  const pedals = snapshot.controlChanges.filter((c) => c.controller === 64);
  if (!pedals.some((c) => c.value >= 64)) errors.push('CC64 on missing');
  if (!pedals.some((c) => c.value < 64)) errors.push('CC64 off missing');
  return { ok: errors.length === 0, errors };
}
