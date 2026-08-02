import type { GrooveFeatures, GrooveProfile } from '@/lib/groove/types';
import type { AccompanimentPattern, GrooveId } from '@/types';

/**
 * GrooveProfile features — abstract only (no MIDI phrases).
 * Defaults calibrated from GT-001 (project/docs/music/GroundTruthMidi.md).
 */
const BASE_FEATURES: GrooveFeatures = {
  swingRatio: 0.5,
  timingBiasBeats: 0,
  /** Mild bar accents; GT-001 has small downbeat/upbeat gap. */
  velocityAccent: [1.05, 0.97, 1.02, 0.97],
  ghostDensity: 0,
  strumMs: 0,
  pedalStyle: 'ringCap',
  humanize: { velocityAmount: 0.07, timingAmountBeats: 0.008 },
};

function featuresFor(
  grooveId: GrooveId,
  accompaniment: AccompanimentPattern,
): GrooveFeatures {
  const swingRatio = grooveId === 'jazzSwing' ? 2 / 3 : 0.5;
  // Ghost denser only for soul pocket — not every sixteenthBeat (G5 / GT-001).
  const ghostDensity = grooveId === 'soul16' ? 0.2 : 0;
  // GT-001 strum band ≈ 0–7 ms (Timing.md / PianoPatterns.md).
  const strumMs =
    accompaniment === 'block'
      ? 5
      : accompaniment === 'eightBeat'
        ? 4
        : accompaniment === 'sixteenthBeat'
          ? 3
          : 0;
  const timingAmountBeats =
    accompaniment === 'eightBeat'
      ? 0.01
      : accompaniment === 'sixteenthBeat'
        ? 0.008
        : accompaniment === 'arpeggio'
          ? 0.006
          : 0;
  const velocityAmount =
    accompaniment === 'block'
      ? 0.03
      : accompaniment === 'eightBeat'
        ? 0.08
        : accompaniment === 'sixteenthBeat'
          ? 0.08
          : 0.06;

  return {
    ...BASE_FEATURES,
    swingRatio,
    ghostDensity,
    strumMs,
    humanize: { velocityAmount, timingAmountBeats },
    velocityAccent: grooveId === 'jazzSwing' ? [] : BASE_FEATURES.velocityAccent,
  };
}

/**
 * Map current UI ids (groove + accompaniment) to a GrooveProfile.
 * Abstract features only — no copied MIDI phrases.
 */
export function grooveProfileFor(
  grooveId: GrooveId,
  accompaniment: AccompanimentPattern,
): GrooveProfile {
  return {
    id: `${grooveId}__${accompaniment}`,
    tags: [grooveId, accompaniment, swingTag(grooveId), 'gt-001'],
    source: { type: 'handcrafted' },
    features: featuresFor(grooveId, accompaniment),
    pianoPatternId: accompaniment,
    drumPatternId: grooveId,
    bassPatternId: 'locked-quarters',
  };
}

function swingTag(grooveId: GrooveId): string {
  return grooveId === 'jazzSwing' ? 'swing' : 'straight';
}

/** All product groove ids (excludes internal pop8-min fixture). */
export const PRODUCT_GROOVE_IDS: GrooveId[] = [
  'pop8',
  'pop16',
  'rock8',
  'rock16',
  'soul16',
  'jazzSwing',
  'bossaNova',
];

export const PRODUCT_ACCOMPANIMENT_IDS: AccompanimentPattern[] = [
  'block',
  'eightBeat',
  'sixteenthBeat',
  'arpeggio',
];
