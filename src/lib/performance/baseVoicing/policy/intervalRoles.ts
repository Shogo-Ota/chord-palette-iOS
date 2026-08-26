/**
 * Interval vocabulary shared by every voicing policy.
 *
 * Everything here is derived from interval arithmetic alone. No chord symbol,
 * no style, no teacher MIDI: `C7(♭9)` and `Db/C` reach the same conclusions if
 * they present the same intervals.
 */

import { wrapPc } from '../../humanTemplate/degreeRoles';

export type IntervalRole =
  'root' | 'third' | 'fifth' | 'alteredFifth' | 'seventh' | 'naturalTension' | 'alteredTension';

export function intervalRole(interval: number): IntervalRole {
  if (interval === 13 || interval === 1 || interval === 15 || interval === 18 || interval === 20) {
    return 'alteredTension';
  }
  if (interval === 14 || interval === 2 || interval === 17 || interval === 5 || interval === 21) {
    return 'naturalTension';
  }
  const normalized = wrapPc(interval);
  if (normalized === 0) return 'root';
  if (normalized === 3 || normalized === 4) return 'third';
  if (normalized === 6 || normalized === 8) return 'alteredFifth';
  if (normalized === 7) return 'fifth';
  if (normalized === 10 || normalized === 11) return 'seventh';
  if (normalized === 9) return 'naturalTension';
  return 'fifth';
}

export function isTensionRole(role: IntervalRole): boolean {
  return role === 'naturalTension' || role === 'alteredTension';
}

export function isGuideRole(role: IntervalRole): boolean {
  return role === 'third' || role === 'seventh' || role === 'alteredFifth' || isTensionRole(role);
}

/**
 * One entry per pitch class, keeping the widest spelling. `add9` written as
 * both 2 and 14 is a single tone; the 14 spelling is what tells the register
 * rules it is an upper extension.
 */
export function uniqueAvailableTones(intervals: readonly number[]): number[] {
  const widestByPc = new Map<number, number>();
  for (const interval of intervals) {
    const pc = wrapPc(interval);
    const current = widestByPc.get(pc);
    if (current == null || interval > current) widestByPc.set(pc, interval);
  }
  return [...widestByPc.values()];
}

/**
 * The extension that carries the chord's identity. A 13th chord is recognised
 * by its 13th, not by the 9th it also happens to contain.
 */
export function topNaturalTension(tones: readonly number[]): number | null {
  const natural = tones.filter((interval) => intervalRole(interval) === 'naturalTension');
  return natural.length === 0 ? null : Math.max(...natural);
}
