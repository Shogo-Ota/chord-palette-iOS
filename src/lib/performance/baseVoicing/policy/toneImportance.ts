/**
 * Which chord tones the right hand keeps when it cannot keep them all.
 *
 * Ranking is by interval role, never by chord symbol: guide tones and explicit
 * colors outrank a plain fifth, and a root already carried by the bass is the
 * cheapest thing to drop.
 */

import { classifyInterval, wrapPc } from '../../humanTemplate/degreeRoles';
import type { ChordHarmonyInput } from '../../strictV2';
import type { BaseVoicingPreference } from '../types';
import { intervalRole, isGuideRole } from './intervalRoles';
import type { ToneFamilyRequest, VoicingToneSpec } from './types';

/** One left-hand note plus at most four right-hand notes stays playable. */
export const MAX_RIGHT_HAND_TONES = 4;

export function toneSpecsForHarmony(harmony: ChordHarmonyInput): VoicingToneSpec[] {
  const seen = new Set<number>();
  const specs: VoicingToneSpec[] = [];
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

/** Slash bass always wins over the inversion preference. */
export function bassToneSpec(
  harmony: ChordHarmonyInput,
  specs: readonly VoicingToneSpec[],
  preference: BaseVoicingPreference,
): VoicingToneSpec {
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

export function tonePriority(spec: VoicingToneSpec, bass: VoicingToneSpec): number {
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

export function supportToneSpecs<T extends { interval: number }>(specs: readonly T[]): T[] {
  return specs.filter((spec) => {
    const role = intervalRole(spec.interval);
    return role === 'root' || role === 'fifth';
  });
}

/** The most complete right hand the four-note limit allows. */
export function primaryToneFamily(
  specs: readonly VoicingToneSpec[],
  bass: VoicingToneSpec,
): VoicingToneSpec[] {
  if (specs.length <= MAX_RIGHT_HAND_TONES) return [...specs];
  return [...specs]
    .sort((left, right) => {
      const priority = tonePriority(right, bass) - tonePriority(left, bass);
      return priority || left.sourceOrder - right.sourceOrder;
    })
    .slice(0, MAX_RIGHT_HAND_TONES)
    .sort((left, right) => left.sourceOrder - right.sourceOrder);
}

function sameFamily(left: readonly VoicingToneSpec[], right: readonly VoicingToneSpec[]): boolean {
  if (left.length !== right.length) return false;
  const key = (specs: readonly VoicingToneSpec[]) =>
    specs
      .map((spec) => spec.pc)
      .sort((a, b) => a - b)
      .join(',');
  return key(left) === key(right);
}

/**
 * Thinner right hands that omit support tones (perfect fifth, a root the bass
 * already holds) so a packed four-note close voicing is not the only option.
 * Guide tones and explicit tensions are never dropped here — the cost model
 * keeps them, which is why a tension can be spread instead of deleted.
 */
export function expandedToneFamilies(request: ToneFamilyRequest): VoicingToneSpec[][] {
  const { specs, bass } = request;
  const primary = primaryToneFamily(specs, bass);
  const families: VoicingToneSpec[][] = [primary];
  const push = (family: VoicingToneSpec[]) => {
    if (family.length < 2 || family.length > MAX_RIGHT_HAND_TONES) return;
    if (families.some((existing) => sameFamily(existing, family))) return;
    families.push(family);
  };

  if (intervalRole(bass.interval) === 'root' && specs.length >= 5) {
    push(
      primaryToneFamily(
        specs.filter((spec) => intervalRole(spec.interval) !== 'root'),
        bass,
      ),
    );
  }

  for (const omitted of supportToneSpecs(primary)) {
    push(primary.filter((spec) => spec.id !== omitted.id));
  }

  const guideTones = specs.filter((spec) => isGuideRole(intervalRole(spec.interval)));
  if (guideTones.length >= 2 && guideTones.length <= MAX_RIGHT_HAND_TONES) push([...guideTones]);

  return families;
}

/**
 * Root position keeps the approved candidate set unchanged. For an explicit
 * inversion, anchor the right hand on the next chord tone above the requested
 * bass so the inversion reshapes the whole hand, not only one low note.
 */
export function preferredRightAnchorPc(
  harmony: ChordHarmonyInput,
  specs: readonly VoicingToneSpec[],
  body: readonly VoicingToneSpec[],
  bass: VoicingToneSpec,
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
