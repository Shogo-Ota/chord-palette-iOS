/**
 * Shared Compact Base Voicing generator.
 *
 * Enumeration only: it lists every legal way to place one left-hand note plus two
 * to four right-hand notes inside the compact register, then asks the policy
 * which of them to keep and how to chain them across the progression. Every
 * musical judgement — which tones may be dropped, what a cluster costs, how much
 * voice leading matters — lives in `policy/`, so a new opinion is a new policy
 * rather than an edit here.
 *
 * The result is style-neutral by construction: Block, Natural, City and every
 * Variation receive identical pitches and may differ only in timing, dynamics
 * and subtractive masks.
 */

import { wrapPc } from '../humanTemplate/degreeRoles';
import type { ChordHarmonyInput } from '../strictV2';
import { compactRegisterPolicy, isCompactHandModel } from './handModel';
import { selectVoicingPath } from './policy/pathSearch';
import { activeVoicingPolicy } from './policy/registry';
import { bassToneSpec, preferredRightAnchorPc, toneSpecsForHarmony } from './policy/toneImportance';
import type { VoicingCostContext, VoicingPolicySpec, VoicingToneSpec } from './policy/types';
import {
  DEFAULT_BASE_VOICING_PREFERENCE,
  type BaseVoicing,
  type BaseVoicingCandidate,
  type BaseVoicingNote,
  type BaseVoicingPreference,
} from './types';

const MAX_CANDIDATES_PER_CHORD = 64;

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  const result: T[][] = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    permutations(rest).forEach((tail) => result.push([item, ...tail]));
  });
  return result;
}

function pitchInstances(pc: number, lo: number, hi: number): number[] {
  const pitches: number[] = [];
  for (let pitch = Math.max(0, lo); pitch <= Math.min(127, hi); pitch += 1) {
    if (wrapPc(pitch) === wrapPc(pc)) pitches.push(pitch);
  }
  return pitches;
}

/** Stack the requested tone order upward from the lowest legal right-hand seat. */
function placeRightHand(
  order: readonly VoicingToneSpec[],
  bass: number,
  preference: BaseVoicingPreference,
): BaseVoicingNote[][] {
  const policy = compactRegisterPolicy(preference);
  const floor = Math.max(policy.rh.lo, bass + policy.minHandGap);
  const candidates: BaseVoicingNote[][] = [];
  for (const firstPitch of pitchInstances(order[0]!.pc, floor, policy.rh.hi)) {
    const notes: BaseVoicingNote[] = [
      {
        pitch: firstPitch,
        pc: order[0]!.pc,
        interval: order[0]!.interval,
        degree: order[0]!.degree,
        hand: 'RH',
        isBass: false,
        isDuplicate: false,
      },
    ];
    let previous = firstPitch;
    let valid = true;
    for (const spec of order.slice(1)) {
      const pitch = pitchInstances(spec.pc, previous + 1, policy.rh.hi)[0];
      if (pitch == null) {
        valid = false;
        break;
      }
      notes.push({
        pitch,
        pc: spec.pc,
        interval: spec.interval,
        degree: spec.degree,
        hand: 'RH',
        isBass: false,
        isDuplicate: false,
      });
      previous = pitch;
    }
    if (valid) candidates.push(notes);
  }
  return candidates;
}

function candidateKey(candidate: BaseVoicingCandidate): string {
  return candidate.notes
    .map((note) => `${note.hand}:${note.pitch}:${note.degree}`)
    .sort()
    .join('|');
}

export function compactCandidatesForHarmony(
  harmony: ChordHarmonyInput,
  preference: BaseVoicingPreference = DEFAULT_BASE_VOICING_PREFERENCE,
  policy: VoicingPolicySpec = activeVoicingPolicy(),
): BaseVoicingCandidate[] {
  const specs = toneSpecsForHarmony(harmony);
  if (specs.length === 0) return [];
  const bass = bassToneSpec(harmony, specs, preference);
  const families = policy.toneFamilies({ harmony, specs, bass });
  const rightAnchorPc = preferredRightAnchorPc(harmony, specs, families[0] ?? [], bass, preference);
  const registers = compactRegisterPolicy(preference);
  const context: VoicingCostContext = {
    rootPc: harmony.rootPc,
    availableIntervals: harmony.chordIntervals,
    preferredRightAnchorPc: rightAnchorPc,
  };
  const candidates: BaseVoicingCandidate[] = [];
  const seen = new Set<string>();

  for (const bassPitch of pitchInstances(bass.pc, registers.lh.lo, registers.lh.hi)) {
    const bassNote: BaseVoicingNote = {
      pitch: bassPitch,
      pc: bass.pc,
      interval: bass.interval,
      degree: bass.degree,
      hand: 'LH',
      isBass: true,
      isDuplicate: false,
    };
    for (const family of families) {
      for (const order of permutations(family)) {
        for (const right of placeRightHand(order, bassPitch, preference)) {
          if (
            policy.rightAnchorMode === 'HARD' &&
            rightAnchorPc != null &&
            right[0]?.pc !== rightAnchorPc
          ) {
            continue;
          }
          const notes = [bassNote, ...right].sort((left, next) => left.pitch - next.pitch);
          if (!isCompactHandModel(notes, registers)) continue;
          const staticCost = policy.staticCost(notes, preference, context);
          if (!Number.isFinite(staticCost)) continue;
          const candidate: BaseVoicingCandidate = {
            notes: notes.map((note) => ({
              ...note,
              isDuplicate: note.hand === 'RH' && note.pc === bass.pc,
            })),
            staticCost,
          };
          const key = candidateKey(candidate);
          if (seen.has(key)) continue;
          seen.add(key);
          candidates.push(candidate);
        }
      }
    }
  }

  return candidates
    .sort(
      (left, right) =>
        left.staticCost - right.staticCost || candidateKey(left).localeCompare(candidateKey(right)),
    )
    .slice(0, MAX_CANDIDATES_PER_CHORD);
}

export function buildCompactBaseVoicings(
  harmonies: readonly ChordHarmonyInput[],
  preference: BaseVoicingPreference = DEFAULT_BASE_VOICING_PREFERENCE,
  policy: VoicingPolicySpec = activeVoicingPolicy(),
): BaseVoicing[] {
  return buildCompactBaseVoicingsWithPreferences(
    harmonies,
    harmonies.map(() => preference),
    policy,
  );
}

/**
 * Resolve one continuous progression while honoring each chord's own inversion.
 * Candidate selection stays global, so per-chord control does not sacrifice
 * voice leading or loop-boundary continuity.
 */
export function buildCompactBaseVoicingsWithPreferences(
  harmonies: readonly ChordHarmonyInput[],
  preferences: readonly BaseVoicingPreference[],
  policy: VoicingPolicySpec = activeVoicingPolicy(),
): BaseVoicing[] {
  if (harmonies.length !== preferences.length) {
    throw new Error(
      `Base voicing preference count ${preferences.length} does not match harmony count ${harmonies.length}`,
    );
  }
  const layers = harmonies.map((harmony, index) =>
    compactCandidatesForHarmony(harmony, preferences[index], policy),
  );
  const missing = layers.findIndex((layer) => layer.length === 0);
  if (missing >= 0) {
    throw new Error(
      `No compact base voicing candidate for chord ${missing}: ${harmonies[missing]!.symbol}`,
    );
  }
  const selected = selectVoicingPath(layers, policy);
  return selected.map((candidate, chordIndex) => ({
    chordIndex,
    harmony: harmonies[chordIndex]!,
    preference: { ...preferences[chordIndex]! },
    notes: candidate.notes.map((note) => ({ ...note })),
  }));
}
