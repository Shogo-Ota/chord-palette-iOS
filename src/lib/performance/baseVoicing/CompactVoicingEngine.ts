import { classifyInterval, wrapPc, type HarmonicDegree } from '../humanTemplate/degreeRoles';
import type { ChordHarmonyInput } from '../strictV2';
import { selectContinuousCandidatePath } from './continuity';
import { compactRegisterPolicy, isCompactHandModel } from './handModel';
import {
  DEFAULT_BASE_VOICING_PREFERENCE,
  type BaseVoicing,
  type BaseVoicingCandidate,
  type BaseVoicingNote,
  type BaseVoicingPreference,
} from './types';
import {
  evaluateVoicingPolicy,
  intervalRole,
  isGuideRole,
  supportToneSpecs,
  type VoicingPolicyContext,
} from './voicingPolicy';

type ToneSpec = {
  id: string;
  pc: number;
  interval: number;
  degree: HarmonicDegree;
  sourceOrder: number;
};

const MAX_CANDIDATES_PER_CHORD = 64;

function toneSpecs(harmony: ChordHarmonyInput): ToneSpec[] {
  const seen = new Set<number>();
  const specs: ToneSpec[] = [];
  harmony.chordIntervals.forEach((interval, sourceOrder) => {
    const pc = wrapPc(harmony.rootPc + interval);
    if (seen.has(pc)) return;
    seen.add(pc);
    specs.push({
      id: `${interval}:${sourceOrder}`,
      pc,
      interval,
      degree: classifyInterval(interval),
      sourceOrder,
    });
  });
  return specs;
}

function inversionIndex(preference: BaseVoicingPreference): number {
  if (preference.position === 'first') return 1;
  if (preference.position === 'second') return 2;
  return 0;
}

function bassSpec(
  harmony: ChordHarmonyInput,
  specs: readonly ToneSpec[],
  preference: BaseVoicingPreference,
): ToneSpec {
  if (harmony.slashBassPc != null) {
    const slashPc = wrapPc(harmony.slashBassPc);
    return (
      specs.find((spec) => spec.pc === slashPc) ?? {
        id: 'slash',
        pc: slashPc,
        interval: wrapPc(slashPc - harmony.rootPc),
        degree: classifyInterval(wrapPc(slashPc - harmony.rootPc)),
        sourceOrder: -1,
      }
    );
  }
  return specs[Math.min(inversionIndex(preference), specs.length - 1)]!;
}

function tonePriority(spec: ToneSpec, harmony: ChordHarmonyInput, bass: ToneSpec): number {
  const normalized = wrapPc(spec.interval);
  if (spec.degree === 'third') return 120;
  if (spec.degree === 'seventh') return 115;
  if (spec.degree === 'ninth' || spec.degree === 'eleventh' || spec.degree === 'thirteenth') {
    return 105 + Math.min(spec.sourceOrder, 9);
  }
  // Altered fifths define diminished/augmented quality and must survive omission.
  if (spec.degree === 'fifth' && normalized !== 7) return 112;
  if (spec.degree === 'root') return bass.pc === spec.pc ? 75 : 100;
  return 70;
}

/**
 * Complex symbols remain simple arrangements: one LH note and at most four RH
 * notes. Guide tones, explicit colors, and altered fifths win over a plain fifth.
 */
function bodySpecs(
  harmony: ChordHarmonyInput,
  specs: readonly ToneSpec[],
  bass: ToneSpec,
): ToneSpec[] {
  if (specs.length <= 4) return [...specs];
  return [...specs]
    .sort((left, right) => {
      const priority = tonePriority(right, harmony, bass) - tonePriority(left, harmony, bass);
      return priority || left.sourceOrder - right.sourceOrder;
    })
    .slice(0, 4)
    .sort((left, right) => left.sourceOrder - right.sourceOrder);
}

function sameFamily(left: readonly ToneSpec[], right: readonly ToneSpec[]): boolean {
  if (left.length !== right.length) return false;
  const key = (specs: readonly ToneSpec[]) =>
    specs
      .map((spec) => spec.pc)
      .sort((a, b) => a - b)
      .join(',');
  return key(left) === key(right);
}

/**
 * Extra RH families omit support tones (perfect 5th / duplicated root) so a
 * legal 4-note close voicing is not the only option when it would pack a
 * semitone. Guide tones and explicit tensions stay required via Policy cost.
 */
function bodyFamilies(
  harmony: ChordHarmonyInput,
  specs: readonly ToneSpec[],
  bass: ToneSpec,
): ToneSpec[][] {
  const primary = bodySpecs(harmony, specs, bass);
  const families: ToneSpec[][] = [primary];
  const push = (family: ToneSpec[]) => {
    if (family.length < 2 || family.length > 4) return;
    if (families.some((existing) => sameFamily(existing, family))) return;
    families.push(family);
  };

  if (intervalRole(bass.interval) === 'root' && specs.length >= 5) {
    push(
      bodySpecs(
        harmony,
        specs.filter((spec) => intervalRole(spec.interval) !== 'root'),
        bass,
      ),
    );
  }

  for (const omitted of supportToneSpecs(primary)) {
    push(primary.filter((spec) => spec.id !== omitted.id));
  }

  const required = specs.filter((spec) => isGuideRole(intervalRole(spec.interval)));
  if (required.length >= 2 && required.length <= 4) push(required);

  return families;
}

/**
 * Root keeps the approved 87-point candidate set unchanged. For explicit
 * inversions, anchor the RH on the next available chord tone above the requested
 * bass so the inversion changes the whole hand shape, not only one low note.
 */
function preferredRightAnchorPc(
  harmony: ChordHarmonyInput,
  specs: readonly ToneSpec[],
  body: readonly ToneSpec[],
  bass: ToneSpec,
  preference: BaseVoicingPreference,
): number | undefined {
  if (preference.position === 'root' || harmony.slashBassPc != null) return undefined;
  const bassIndex = specs.findIndex((spec) => spec.pc === bass.pc);
  if (bassIndex < 0) return undefined;
  for (let offset = 1; offset <= specs.length; offset += 1) {
    const candidate = specs[(bassIndex + offset) % specs.length]!;
    if (body.some((spec) => spec.pc === candidate.pc)) return candidate.pc;
  }
  return undefined;
}

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

function placeRightHand(
  order: readonly ToneSpec[],
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

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function registerPlacementCost(
  notes: readonly BaseVoicingNote[],
  preference: BaseVoicingPreference,
): number {
  const policy = compactRegisterPolicy(preference);
  const left = notes.filter((note) => note.hand === 'LH');
  const right = notes.filter((note) => note.hand === 'RH').sort((a, b) => a.pitch - b.pitch);
  const bass = left[0]!.pitch;
  const rightPitches = right.map((note) => note.pitch);
  const rightLow = rightPitches[0]!;
  const top = rightPitches[rightPitches.length - 1]!;
  const rightSpan = top - rightLow;
  const totalSpan = top - bass;
  const targetRightSpan = right.length <= 3 ? 9 : 11;
  const targetTotalSpan = right.length <= 3 ? 20 : 24;

  let cost = Math.abs(bass - policy.lh.center) * 0.8;
  cost += Math.abs(mean(rightPitches) - policy.rh.center) * 0.65;
  cost += Math.abs(rightSpan - targetRightSpan) * 0.35;
  cost += Math.abs(totalSpan - targetTotalSpan) * 0.25;
  return cost;
}

function staticVoicingCost(
  notes: readonly BaseVoicingNote[],
  preference: BaseVoicingPreference,
  context: VoicingPolicyContext,
): number {
  const policy = evaluateVoicingPolicy(notes, preference, context);
  if (policy.hardReject) return Number.POSITIVE_INFINITY;
  return registerPlacementCost(notes, preference) + policy.totalSoftCost;
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
): BaseVoicingCandidate[] {
  const specs = toneSpecs(harmony);
  if (specs.length === 0) return [];
  const bass = bassSpec(harmony, specs, preference);
  const families = bodyFamilies(harmony, specs, bass);
  const rightAnchorPc = preferredRightAnchorPc(harmony, specs, families[0] ?? [], bass, preference);
  const policy = compactRegisterPolicy(preference);
  const context: VoicingPolicyContext = {
    rootPc: harmony.rootPc,
    availableIntervals: harmony.chordIntervals,
    preferredRightAnchorPc: rightAnchorPc,
  };
  const candidates: BaseVoicingCandidate[] = [];
  const seen = new Set<string>();

  for (const bassPitch of pitchInstances(bass.pc, policy.lh.lo, policy.lh.hi)) {
    const bassNote: BaseVoicingNote = {
      pitch: bassPitch,
      pc: bass.pc,
      interval: bass.interval,
      degree: bass.degree,
      hand: 'LH',
      isBass: true,
      isDuplicate: false,
    };
    for (const body of families) {
      for (const order of permutations(body)) {
        for (const right of placeRightHand(order, bassPitch, preference)) {
          const notes = [bassNote, ...right].sort((left, next) => left.pitch - next.pitch);
          if (!isCompactHandModel(notes, policy)) continue;
          const scored = staticVoicingCost(notes, preference, context);
          if (!Number.isFinite(scored)) continue;
          const candidate: BaseVoicingCandidate = {
            notes: notes.map((note) => ({
              ...note,
              isDuplicate: note.hand === 'RH' && note.pc === bass.pc,
            })),
            staticCost: scored,
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
): BaseVoicing[] {
  return buildCompactBaseVoicingsWithPreferences(
    harmonies,
    harmonies.map(() => preference),
  );
}

/**
 * Resolve one continuous progression while honoring each chord's own inversion.
 * Candidate selection remains global, so per-chord control does not sacrifice
 * voice-leading or loop-boundary continuity.
 */
export function buildCompactBaseVoicingsWithPreferences(
  harmonies: readonly ChordHarmonyInput[],
  preferences: readonly BaseVoicingPreference[],
): BaseVoicing[] {
  if (harmonies.length !== preferences.length) {
    throw new Error(
      `Base voicing preference count ${preferences.length} does not match harmony count ${harmonies.length}`,
    );
  }
  const layers = harmonies.map((harmony, index) =>
    compactCandidatesForHarmony(harmony, preferences[index]),
  );
  const missing = layers.findIndex((layer) => layer.length === 0);
  if (missing >= 0) {
    throw new Error(
      `No compact base voicing candidate for chord ${missing}: ${harmonies[missing]!.symbol}`,
    );
  }
  const selected = selectContinuousCandidatePath(layers);
  return selected.map((candidate, chordIndex) => ({
    chordIndex,
    harmony: harmonies[chordIndex]!,
    preference: { ...preferences[chordIndex]! },
    notes: candidate.notes.map((note) => ({ ...note })),
  }));
}
