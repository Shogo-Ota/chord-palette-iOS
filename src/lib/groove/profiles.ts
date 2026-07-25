import type { GrooveFeatures, GrooveProfile } from '@/lib/groove/types';
import type { AccompanimentPattern, GrooveId } from '@/types';

const BASE_FEATURES: GrooveFeatures = {
  swingRatio: 0.5,
  timingBiasBeats: 0,
  velocityAccent: [],
  ghostDensity: 0,
  strumMs: 0,
  pedalStyle: 'ringCap',
  humanize: { velocityAmount: 0.07, timingAmountBeats: 0.015 },
};

function featuresFor(
  grooveId: GrooveId,
  accompaniment: AccompanimentPattern,
): GrooveFeatures {
  const swingRatio = grooveId === 'jazzSwing' ? 2 / 3 : 0.5;
  const ghostDensity = grooveId === 'soul16' || accompaniment === 'sixteenthBeat' ? 0.25 : 0;
  const strumMs =
    accompaniment === 'block' ? 12 : accompaniment === 'eightBeat' ? 5 : accompaniment === 'sixteenthBeat' ? 2 : 0;
  const timingAmountBeats =
    accompaniment === 'eightBeat' ? 0.018 : accompaniment === 'sixteenthBeat' ? 0.014 : 0;
  const velocityAmount =
    accompaniment === 'block' ? 0.02 : accompaniment === 'eightBeat' ? 0.11 : accompaniment === 'sixteenthBeat' ? 0.12 : 0.07;

  return {
    ...BASE_FEATURES,
    swingRatio,
    ghostDensity,
    strumMs,
    humanize: { velocityAmount, timingAmountBeats },
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
    tags: [grooveId, accompaniment, swingTag(grooveId)],
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
