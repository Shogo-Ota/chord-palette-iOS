/**
 * Haptics helpers (sprint-7 Phase D / UI refinement §6).
 * Fail-soft: never throw into UI. Skip when Reduce Motion is preferred.
 */

import { AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.()
  .then((v) => {
    reduceMotion = !!v;
  })
  .catch(() => undefined);
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => {
  reduceMotion = !!v;
});

async function run(fn: () => Promise<void>): Promise<void> {
  if (reduceMotion) return;
  try {
    await fn();
  } catch {
    // Haptics unavailable on some platforms / Expo Go builds — ignore.
  }
}

/** Chord pick / canvas select. */
export function hapticSelection(): void {
  void run(() => Haptics.selectionAsync());
}

/** Reorder drop / soft UI confirm. */
export function hapticSoft(): void {
  void run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
}

/** First meaningful milestone (e.g. 4 chords placed). */
export function hapticSuccess(): void {
  void run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Error / load failure. */
export function hapticError(): void {
  void run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
