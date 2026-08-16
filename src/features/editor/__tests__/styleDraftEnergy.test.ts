/**
 * Style draft energy field — held across style changes, committed separately.
 * Pure helpers mirror useStyleDraft behaviour without mounting React.
 */

import {
  DEFAULT_ENERGY,
  normalizeEnergy,
  type AccompanimentEnergy,
} from '@/lib/performance/energy';
import { defaultVariantFor } from '@/lib/performance/variants';
import type { AccompanimentPattern, GrooveId, InstrumentId } from '@/types';

type StyleDraft = {
  instrumentId: InstrumentId;
  grooveId: GrooveId;
  accompanimentPattern: AccompanimentPattern;
  accompanimentVariant: string;
  accompanimentEnergy: AccompanimentEnergy;
};

function setAccompaniment(draft: StyleDraft, pattern: AccompanimentPattern): StyleDraft {
  return {
    ...draft,
    accompanimentPattern: pattern,
    accompanimentVariant: defaultVariantFor(pattern).id,
    // Energy is KEPT across style / pattern changes (§13).
  };
}

function setInstrument(draft: StyleDraft, instrumentId: InstrumentId): StyleDraft {
  return { ...draft, instrumentId };
}

function setEnergy(draft: StyleDraft, energy: AccompanimentEnergy): StyleDraft {
  return { ...draft, accompanimentEnergy: normalizeEnergy(energy) };
}

describe('StyleDraft energy hold', () => {
  const initial: StyleDraft = {
    instrumentId: 'piano',
    grooveId: 'pop8',
    accompanimentPattern: 'relaxed',
    accompanimentVariant: defaultVariantFor('relaxed').id,
    accompanimentEnergy: DEFAULT_ENERGY,
  };

  it('defaults to build', () => {
    expect(initial.accompanimentEnergy).toBe('build');
  });

  it('keeps energy when style (pattern) changes', () => {
    const withChorus = setEnergy(initial, 'chorus');
    const afterStyle = setAccompaniment(withChorus, 'driving');
    expect(afterStyle.accompanimentEnergy).toBe('chorus');
    expect(afterStyle.accompanimentPattern).toBe('driving');
    expect(afterStyle.accompanimentVariant).toBe(defaultVariantFor('driving').id);
  });

  it('keeps energy when instrument changes', () => {
    const withVerse = setEnergy(initial, 'verse');
    const afterSound = setInstrument(withVerse, 'ePiano');
    expect(afterSound.accompanimentEnergy).toBe('verse');
    expect(afterSound.instrumentId).toBe('ePiano');
  });

  it('draft energy can diverge from applied (session) until commit', () => {
    const applied: AccompanimentEnergy = 'build';
    const draft = setEnergy(initial, 'chorus');
    expect(draft.accompanimentEnergy).not.toBe(applied);
    const committed = draft.accompanimentEnergy;
    expect(committed).toBe('chorus');
  });
});
