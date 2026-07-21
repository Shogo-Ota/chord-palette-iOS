import { FEEL_IDS, isFeelId, resolveFeel } from '@/lib/performance/feel/resolve';
import type { FeelContext } from '@/lib/performance/feel/types';

const GROOVES = ['pop8', 'pop16', 'rock8', 'rock16', 'soul16', 'bossaNova'];
const TEMPOS = [68, 100, 120, 150];

describe('isFeelId / FEEL_IDS', () => {
  it('lists the three feels in UI order', () => {
    expect(FEEL_IDS).toEqual(['natural', 'driving', 'relaxed']);
  });

  it('recognises the three feels and rejects direct styles', () => {
    for (const id of FEEL_IDS) expect(isFeelId(id)).toBe(true);
    for (const id of ['block', 'arpeggio', 'eightBeat', 'sixteenBeat', 'ballad', '']) {
      expect(isFeelId(id)).toBe(false);
    }
  });
});

describe('resolveFeel — template + variation + humanizeScale', () => {
  it('returns a valid, complete ResolvedFeel for every feel × tempo × groove', () => {
    for (const feel of FEEL_IDS) {
      for (const tempoBpm of TEMPOS) {
        for (const grooveId of GROOVES) {
          const r = resolveFeel(feel, { tempoBpm, grooveId });
          // template skeleton is well-formed
          expect(r.template).toBeDefined();
          expect(r.template.chord.hits.length).toBe(r.template.stepsPerBar);
          expect(r.template.bass.hits.length).toBe(r.template.stepsPerBar);
          // variation profile present with in-range probabilities
          expect(r.variation).toBeDefined();
          expect(r.variation.rests.probability).toBeGreaterThanOrEqual(0);
          expect(r.variation.rests.probability).toBeLessThanOrEqual(1);
          // humanize scale is a sensible positive multiplier
          expect(r.humanizeScale).toBeGreaterThan(0);
          expect(r.humanizeScale).toBeLessThan(2);
        }
      }
    }
  });

  it('is a pure function (identical inputs ⇒ deep-equal result)', () => {
    const ctx: FeelContext = { tempoBpm: 110, grooveId: 'pop8' };
    for (const feel of FEEL_IDS) {
      expect(resolveFeel(feel, ctx)).toEqual(resolveFeel(feel, ctx));
    }
  });

  it('driving picks the busier 16-step base when fast or on a 16-groove', () => {
    expect(resolveFeel('driving', { tempoBpm: 130, grooveId: 'pop8' }).template.stepsPerBar).toBe(16);
    expect(resolveFeel('driving', { tempoBpm: 90, grooveId: 'pop16' }).template.stepsPerBar).toBe(16);
    expect(resolveFeel('driving', { tempoBpm: 90, grooveId: 'pop8' }).template.stepsPerBar).toBe(8);
  });

  it('driving adds a role-separation top voice; natural leaves it out', () => {
    expect(resolveFeel('natural', { tempoBpm: 100, grooveId: 'pop8' }).template.top).toBeUndefined();
    expect(resolveFeel('driving', { tempoBpm: 100, grooveId: 'pop8' }).template.top).toBeDefined();
  });

  it('relaxed adds a single 3rd on beat 3 (step 4) as its top voice', () => {
    const t = resolveFeel('relaxed', { tempoBpm: 80, grooveId: 'pop8' }).template;
    expect(t.top).toBeDefined();
    expect(t.topTone).toBe('third');
    // Only beat 3 (step 4 of the 8-step ballad bar) is a hit.
    expect(t.top!.hits).toEqual([false, false, false, false, true, false, false, false]);
  });

  it('natural uses the Good Song Top 10 quarter-note chord + & bass skeleton', () => {
    const t = resolveFeel('natural', { tempoBpm: 90, grooveId: 'pop8' }).template;
    expect(t.id).toBe('naturalComp');
    expect(t.chord.hits).toEqual([true, false, true, false, true, false, true, false]);
    expect(t.bass.hits).toEqual([false, true, false, true, false, true, false, true]);
  });

  it('humanize scales encode the feel intent (driving tightest, relaxed loosest)', () => {
    const ctx: FeelContext = { tempoBpm: 100, grooveId: 'pop8' };
    const natural = resolveFeel('natural', ctx).humanizeScale;
    const driving = resolveFeel('driving', ctx).humanizeScale;
    const relaxed = resolveFeel('relaxed', ctx).humanizeScale;
    expect(driving).toBeLessThan(natural);
    expect(relaxed).toBeGreaterThan(natural);
  });

  it('relaxed lays back (positive chord/bass microtiming window)', () => {
    const t = resolveFeel('relaxed', { tempoBpm: 80, grooveId: 'pop8' }).template;
    expect(t.microtiming.chord.max).toBeGreaterThan(0);
    expect(t.microtiming.bass.max).toBeGreaterThan(0);
  });
});
