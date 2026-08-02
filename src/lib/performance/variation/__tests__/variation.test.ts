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

describe('applyTwoFourBar — phrase-position variation (v1.01 Phase 8)', () => {
  // Only the position rule fires, at probability 1, over two 4-bar phrases.
  const POSITION_ONLY: VariationProfile = {
    ...NOOP,
    twoFourBar: { probability: 1, maxPerPhrase: 1 },
  };
  const CTX8: VariationContext = { ...CTX, bars: 8 };

  function keysOf(list: Strike[]): Set<string> {
    return new Set(list.map((s) => `${s.bar}:${s.step}`));
  }

  it('adds stabs only on bars 2–3 and thins only bar 4 of each phrase', () => {
    const input = chordStrikes(8);
    const out = applyVariation({ chord: input }, EIGHT_BEAT, CTX8, POSITION_ONLY, 21);
    const before = keysOf(input);
    const after = keysOf(out.chord ?? []);

    for (const key of after) {
      if (before.has(key)) continue;
      const bar = Number(key.split(':')[0]);
      expect([1, 2, 5, 6]).toContain(bar); // added = small change, bars 2–3
    }
    for (const key of before) {
      if (after.has(key)) continue;
      const [bar, step] = key.split(':').map(Number);
      expect(bar % 4).toBe(3); // removed = connecting change, bar 4 only
      expect(step).not.toBe(0); // never the bar head
    }
  });

  it('leaves the progression’s final bar to the phrase-end sustain', () => {
    const input = chordStrikes(8);
    const out = applyVariation({ chord: input }, EIGHT_BEAT, CTX8, POSITION_ONLY, 21);
    const finalBefore = input.filter((s) => s.bar === 7).length;
    const finalAfter = (out.chord ?? []).filter((s) => s.bar === 7).length;
    expect(finalAfter).toBe(finalBefore);
  });

  it('the connecting change actually fires on the first phrase boundary', () => {
    const input = chordStrikes(8);
    const out = applyVariation({ chord: input }, EIGHT_BEAT, CTX8, POSITION_ONLY, 21);
    const bar3Before = input.filter((s) => s.bar === 3).length;
    const bar3After = (out.chord ?? []).filter((s) => s.bar === 3).length;
    expect(bar3After).toBe(bar3Before - 1);
  });
});
