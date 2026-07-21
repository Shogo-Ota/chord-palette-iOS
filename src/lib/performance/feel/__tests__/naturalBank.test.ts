import { NATURAL_BANK, pickNaturalTemplate } from '@/lib/performance/feel/naturalBank';
import { resolveFeel } from '@/lib/performance/feel/resolve';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import {
  generatePerformance,
  type PerfChord,
  type PerformanceInput,
} from '@/lib/performance/PerformanceEngine';

/* ------------------------------------------------------------------ */
/* The bank: three members sharing everything but the bass rhythm.     */
/* ------------------------------------------------------------------ */
describe('NATURAL_BANK', () => {
  it('is [A, B, C] with A (naturalComp) first for backward compatibility', () => {
    expect(NATURAL_BANK.map((t) => t.id)).toEqual([
      'naturalComp',
      'naturalCompSparse',
      'naturalCompDense',
    ]);
  });

  it('every member shares grid / gate / velocity / microtiming and the quarter-note chord', () => {
    const [a, ...rest] = NATURAL_BANK;
    for (const t of rest) {
      expect(t.stepsPerBar).toBe(a.stepsPerBar);
      expect(t.beatsPerBar).toBe(a.beatsPerBar);
      expect(t.gate).toEqual(a.gate);
      expect(t.velocity).toEqual(a.velocity);
      expect(t.microtiming).toEqual(a.microtiming);
      expect(t.kickFeelMs).toEqual(a.kickFeelMs);
      expect(t.roundRobin).toBe(a.roundRobin);
      // Same straight quarter-note chord body; only the bass differs between members.
      expect(t.chord.hits).toEqual(a.chord.hits);
    }
  });

  it('the three bass rhythms are all distinct (that is the whole point of the bank)', () => {
    const [a, b, c] = NATURAL_BANK;
    expect(b.bass.hits).not.toEqual(a.bass.hits);
    expect(c.bass.hits).not.toEqual(a.bass.hits);
    expect(c.bass.hits).not.toEqual(b.bass.hits);
    // Only C (dense) plays a bass note on beat 2 (8th step 2) — a unique marker.
    expect(a.bass.hits[2]).toBe(false);
    expect(b.bass.hits[2]).toBe(false);
    expect(c.bass.hits[2]).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* pickNaturalTemplate: deterministic per (seed, phrase), rotates.     */
/* ------------------------------------------------------------------ */
describe('pickNaturalTemplate', () => {
  it('is deterministic: same seed + phrase ⇒ identical template', () => {
    for (const seed of [1, 2, 777, 20260719]) {
      for (const phrase of [0, 1, 2, 3, 7]) {
        expect(pickNaturalTemplate(seed, phrase)).toBe(pickNaturalTemplate(seed, phrase));
      }
    }
  });

  it('never indexes outside the bank', () => {
    for (let phrase = 0; phrase < 300; phrase++) {
      expect(NATURAL_BANK).toContain(pickNaturalTemplate(4242, phrase));
    }
  });

  it('rotates through more than one member across a long progression', () => {
    const ids = new Set<string>();
    for (let phrase = 0; phrase < 64; phrase++) ids.add(pickNaturalTemplate(12345, phrase).id);
    expect(ids.size).toBeGreaterThan(1);
  });

  it('reaches every member for at least one seed (all three are actually usable)', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 50 && seen.size < NATURAL_BANK.length; seed++) {
      seen.add(pickNaturalTemplate(seed, 0).id);
    }
    expect(seen.size).toBe(NATURAL_BANK.length);
  });
});

/* ------------------------------------------------------------------ */
/* Engine wiring: Natural rotates the template per 4-bar phrase.       */
/* ------------------------------------------------------------------ */

/** An N-bar progression of one chord per 4-beat bar (so every phrase is full). */
function progression(bars: number): PerfChord[] {
  return Array.from({ length: bars }, (_, i) => ({
    bodyMidi: [60, 64, 67],
    bassMidi: [36, 48],
    startBeat: i * 4,
    durationBeats: 4,
  }));
}

/** Bass step positions (8th steps within a bar) actually played inside a phrase. */
function bassStepsInPhrase(events: NoteEvent[], phrase: number, phraseLen = 4): number[] {
  const steps = new Set<number>();
  for (const e of events) {
    if (e.trackId !== 'bass') continue;
    const bar = Math.floor(e.timeBeat / 4 + 1e-6);
    if (bar < phrase * phraseLen || bar >= (phrase + 1) * phraseLen) continue;
    const within = e.timeBeat - bar * 4; // beats past the bar head
    steps.add(Math.round(within / 0.5)); // 8th-note grid step
  }
  return [...steps].sort((x, y) => x - y);
}

describe('PerformanceEngine — Natural phrase rotation', () => {
  const EIGHT_BARS: PerfChord[] = progression(8); // exactly two 4-bar phrases

  it('is deterministic (same seed ⇒ identical events)', () => {
    const input: PerformanceInput = { chords: EIGHT_BARS, bpm: 108, seed: 20260719 };
    const a = generatePerformance(input, { styleId: 'natural', grooveId: 'pop8' });
    const b = generatePerformance(input, { styleId: 'natural', grooveId: 'pop8' });
    expect(a).toEqual(b);
  });

  it('plays a DIFFERENT bass rhythm in phrase 0 vs phrase 1 when the bank rotates', () => {
    // The Variation layer only ever rewrites chord/top strikes — never bass — so the
    // bass step-set of a phrase is exactly its template's bass rhythm. Find a seed whose
    // first two phrases pick different templates and assert the played bass differs.
    let checked = false;
    for (let seed = 1; seed <= 100; seed++) {
      const t0 = pickNaturalTemplate(seed, 0);
      const t1 = pickNaturalTemplate(seed, 1);
      if (t0.id === t1.id) continue;
      const events = generatePerformance(
        { chords: EIGHT_BARS, bpm: 108, seed },
        { styleId: 'natural', grooveId: 'pop8', drums: false },
      );
      expect(bassStepsInPhrase(events, 0)).not.toEqual(bassStepsInPhrase(events, 1));
      checked = true;
      break;
    }
    expect(checked).toBe(true);
  });

  it('only a C (dense) phrase puts a bass note on beat 2 — a variation-proof marker', () => {
    // Find a seed where exactly one of the first two phrases is the dense template C.
    let checked = false;
    for (let seed = 1; seed <= 200; seed++) {
      const isDense0 = pickNaturalTemplate(seed, 0).id === 'naturalCompDense';
      const isDense1 = pickNaturalTemplate(seed, 1).id === 'naturalCompDense';
      if (isDense0 === isDense1) continue; // need exactly one dense phrase
      const events = generatePerformance(
        { chords: EIGHT_BARS, bpm: 108, seed },
        { styleId: 'natural', grooveId: 'pop8', drums: false },
      );
      const beat2InPhrase = (phrase: number) => bassStepsInPhrase(events, phrase).includes(2);
      expect(beat2InPhrase(0)).toBe(isDense0);
      expect(beat2InPhrase(1)).toBe(isDense1);
      checked = true;
      break;
    }
    expect(checked).toBe(true);
  });

  it('a short (single-phrase) progression still renders valid, stable Natural events', () => {
    const input: PerformanceInput = { chords: progression(4), bpm: 100, seed: 55 };
    const events = generatePerformance(input, { styleId: 'natural', grooveId: 'pop8' });
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.velocity >= 1 && e.velocity <= 127)).toBe(true);
    expect(events.every((e) => e.durationBeat > 0)).toBe(true);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].timeBeat).toBeGreaterThanOrEqual(events[i - 1].timeBeat - 1e-9);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Backward compatibility: resolveFeel('natural') is unchanged (= A).  */
/* ------------------------------------------------------------------ */
describe('resolveFeel(natural) — still resolves to bank member A', () => {
  it('keeps the original naturalComp template + straight-quarter chord / walking & bass', () => {
    const t = resolveFeel('natural', { tempoBpm: 100, grooveId: 'pop8' }).template;
    expect(t.id).toBe('naturalComp');
    expect(t.id).toBe(NATURAL_BANK[0].id);
    expect(t.chord.hits).toEqual([true, false, true, false, true, false, true, false]);
    expect(t.bass.hits).toEqual([false, true, false, true, false, true, false, true]);
  });
});
