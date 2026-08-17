import type { BaseVoicingNote, BaseVoicingPreference } from './types';

export type CompactRegisterPolicy = {
  lh: { lo: number; hi: number; center: number };
  rh: { lo: number; hi: number; center: number };
  maxRhSpan: number;
  maxTotalSpan: number;
  minHandGap: number;
};

const DEFAULT_COMPACT_REGISTER_POLICY: CompactRegisterPolicy = {
  lh: { lo: 36, hi: 48, center: 41 },
  rh: { lo: 48, hi: 72, center: 60 },
  maxRhSpan: 16,
  maxTotalSpan: 36,
  minHandGap: 5,
};

export function compactRegisterPolicy(preference: BaseVoicingPreference): CompactRegisterPolicy {
  const shift = preference.octaveShift * 12;
  const move = (window: { lo: number; hi: number; center: number }) => ({
    lo: window.lo + shift,
    hi: window.hi + shift,
    center: window.center + shift,
  });
  return {
    lh: move(DEFAULT_COMPACT_REGISTER_POLICY.lh),
    rh: move(DEFAULT_COMPACT_REGISTER_POLICY.rh),
    maxRhSpan: DEFAULT_COMPACT_REGISTER_POLICY.maxRhSpan,
    maxTotalSpan: DEFAULT_COMPACT_REGISTER_POLICY.maxTotalSpan,
    minHandGap: DEFAULT_COMPACT_REGISTER_POLICY.minHandGap,
  };
}

export function isCompactHandModel(
  notes: readonly BaseVoicingNote[],
  policy: CompactRegisterPolicy,
): boolean {
  const ordered = [...notes].sort((left, right) => left.pitch - right.pitch);
  const left = ordered.filter((note) => note.hand === 'LH');
  const right = ordered.filter((note) => note.hand === 'RH');
  if (left.length !== 1 || right.length < 2 || right.length > 4) return false;
  if (ordered.length < 3 || ordered.length > 5) return false;
  if (new Set(ordered.map((note) => note.pitch)).size !== ordered.length) return false;

  const bass = left[0]!.pitch;
  const rightLow = right[0]!.pitch;
  const rightTop = right[right.length - 1]!.pitch;
  if (bass < policy.lh.lo || bass > policy.lh.hi) return false;
  if (rightLow < policy.rh.lo || rightTop > policy.rh.hi) return false;
  if (rightLow - bass < policy.minHandGap) return false;
  if (rightTop - rightLow > policy.maxRhSpan) return false;
  return rightTop - bass <= policy.maxTotalSpan;
}
