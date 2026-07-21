import type { Strike, StrikesByTrack } from '@/lib/performance/strike';
import { EIGHT_BEAT } from '@/lib/performance/styles/eightBeat';
import { stepBeat } from '@/lib/performance/styles/types';
import { applyVariation } from '@/lib/performance/variation';
import type { VariationContext, VariationProfile } from '@/lib/performance/variation/types';

/** Build the raw EIGHT_BEAT chord strikes (pre-variation) for `bars` bars. */
function chordStrikes(bars: number): Strike[] {
  const style = EIGHT_BEAT;
  const out: Strike[] = [];
  for (let bar = 0; bar < bars; bar++) {
    for (let step = 0; step < style.stepsPerBar; step++) {
      if (!style.chord.hits[step]) continue;
      out.push({
        bar,
        step,
        gridBeat: bar * style.beatsPerBar + stepBeat(style, step),
        accent: style.chord.accent[step],
        ghost: false,
        pitches: [60, 64, 67],
      });
    }
  }
  return out;
}

const CTX: VariationContext = {
  bars: 4,
  beatsPerBar: 4,
  stepsPerBar: 8,
  phraseLength: 4,
  bpm: 110,
};

// Aggressive profile (bassOnly disabled) to stress-test the protected bar heads.
const AGGRESSIVE: VariationProfile = {
  rests: { probability: 1, maxPerPhrase: 8 },
  ties: { probability: 1, maxPerPhrase: 8 },
  twoFourBar: { probability: 1, maxPerPhrase: 1 },
  phraseFill: { sustainFinal: true, extraStabProbability: 1 },
  bassOnly: { probability: 0, maxPerPhrase: 0 },
};

const NOOP: VariationProfile = {
  rests: { probability: 0, maxPerPhrase: 0 },
  ties: { probability: 0, maxPerPhrase: 0 },
  twoFourBar: { probability: 0, maxPerPhrase: 0 },
  phraseFill: { sustainFinal: false, extraStabProbability: 0 },
  bassOnly: { probability: 0, maxPerPhrase: 0 },
};

// Middle-of-the-road probabilities so the seed actually drives which rules fire
// (a probability-1 profile would fire everywhere and be seed-independent).
const MODERATE: VariationProfile = {
  rests: { probability: 0.5, maxPerPhrase: 3 },
  ties: { probability: 0.5, maxPerPhrase: 2 },
  twoFourBar: { probability: 0.5, maxPerPhrase: 1 },
  phraseFill: { sustainFinal: false, extraStabProbability: 0.5 },
  bassOnly: { probability: 0.2, maxPerPhrase: 1 },
};

// Only the phrase-end sustain, with no extra stab that could be appended after it.
const SUSTAIN_ONLY: VariationProfile = {
  rests: { probability: 0, maxPerPhrase: 0 },
  ties: { probability: 0, maxPerPhrase: 0 },
  twoFourBar: { probability: 0, maxPerPhrase: 0 },
  phraseFill: { sustainFinal: true, extraStabProbability: 0 },
  bassOnly: { probability: 0, maxPerPhrase: 0 },
};

describe('applyVariation — protected downbeats', () => {
  it('never removes a bar head (step 0), for any seed, even under an aggressive profile', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const out = applyVariation({ chord: chordStrikes(4) }, EIGHT_BEAT, CTX, AGGRESSIVE, seed);
      for (let bar = 0; bar < 4; bar++) {
        expect(out.chord?.some((s) => s.bar === bar && s.step === 0)).toBe(true);
      }
    }
  });
});

describe('applyVariation — determinism & purity', () => {
  it('is deterministic for the same seed (deep-equal rewrite)', () => {
    const a = applyVariation({ chord: chordStrikes(4) }, EIGHT_BEAT, CTX, AGGRESSIVE, 777);
    const b = applyVariation({ chord: chordStrikes(4) }, EIGHT_BEAT, CTX, AGGRESSIVE, 777);
    expect(a).toEqual(b);
  });

  it('different seeds generally differ (not a constant rewrite)', () => {
    const a = applyVariation({ chord: chordStrikes(8) }, EIGHT_BEAT, { ...CTX, bars: 8 }, MODERATE, 1);
    const b = applyVariation({ chord: chordStrikes(8) }, EIGHT_BEAT, { ...CTX, bars: 8 }, MODERATE, 2);
    expect(a).not.toEqual(b);
  });

  it('does not mutate the caller-supplied strikes', () => {
    const input: StrikesByTrack = { chord: chordStrikes(4) };
    const before = input.chord!.length;
    applyVariation(input, EIGHT_BEAT, CTX, AGGRESSIVE, 5);
    expect(input.chord!.length).toBe(before);
  });

  it('a zero profile leaves the strike count unchanged (identity)', () => {
    const input = chordStrikes(4);
    const out = applyVariation({ chord: input }, EIGHT_BEAT, CTX, NOOP, 3);
    expect(out.chord?.length).toBe(input.length);
  });
});

describe('applyVariation — musical effects', () => {
  it('sustainFinal marks the last-sounding chord strike as held', () => {
    const out = applyVariation({ chord: chordStrikes(4) }, EIGHT_BEAT, CTX, SUSTAIN_ONLY, 11);
    const list = out.chord ?? [];
    const last = list.reduce((m, s) => (s.gridBeat > m.gridBeat ? s : m), list[0]);
    expect(last.sustain).toBe(true);
  });

  it('keeps strikes sorted in grid order after add/remove rules', () => {
    const out = applyVariation({ chord: chordStrikes(4) }, EIGHT_BEAT, CTX, AGGRESSIVE, 9);
    const list = out.chord ?? [];
    for (let i = 1; i < list.length; i++) {
      expect(list[i].gridBeat).toBeGreaterThanOrEqual(list[i - 1].gridBeat);
    }
  });
});
