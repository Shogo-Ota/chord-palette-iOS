/**
 * Voicing aesthetics (inversion/octave placement) — the DEFAULT path is a guaranteed
 * no-op (no regression vs. the previous output), and the named presets respect their
 * declared register windows / relative centre. Uses range assertions rather than a
 * brittle exact snapshot.
 */

import {
  DEFAULT_VOICE_LEADING_OPTIONS,
  VOICING_AESTHETICS,
  voicingAestheticFor,
} from '@/lib/performance/voiceLeading';
import { progressionToChordSpecs } from '@/lib/voicing';
import type { ChordEvent, MajorKey } from '@/types';

const KEY: MajorKey = 'C';

function ev(rootOffset: number, suffix: string): ChordEvent {
  return {
    id: `c${rootOffset}${suffix}`,
    chordId: 'x',
    displayName: 'x',
    degreeLabel: 'I',
    function: 'tonic',
    durationBeats: 4,
    isPro: false,
    rootOffset,
    suffix,
  } as ChordEvent;
}

// A 4536-ish progression exercising several qualities.
const PROG: ChordEvent[] = [ev(0, 'maj7'), ev(9, 'm7'), ev(5, 'maj7'), ev(7, '7')];

/** body notes = everything above the single anchored bass note (index 0). */
function bodyNotes(spec: { midiNotes: number[] }): number[] {
  return spec.midiNotes.slice(1);
}

function meanBody(specs: { midiNotes: number[] }[]): number {
  const notes = specs.flatMap(bodyNotes);
  return notes.reduce((s, n) => s + n, 0) / notes.length;
}

describe('voicingAestheticFor — conservative feel → aesthetic map', () => {
  it('maps relaxed → warmLow, driving → brightOpen', () => {
    expect(voicingAestheticFor('relaxed')).toBe(VOICING_AESTHETICS.warmLow);
    expect(voicingAestheticFor('driving')).toBe(VOICING_AESTHETICS.brightOpen);
  });

  it('keeps everything else on balanced = the engine default (referentially)', () => {
    for (const id of ['natural', 'block', 'arpeggio', 'eightBeat', 'anything']) {
      expect(voicingAestheticFor(id)).toBe(VOICING_AESTHETICS.balanced);
    }
    expect(VOICING_AESTHETICS.balanced).toBe(DEFAULT_VOICE_LEADING_OPTIONS);
  });

  it('pro tier gets proOpen uniformly, for every feel', () => {
    for (const id of ['natural', 'relaxed', 'driving', 'block', 'anything']) {
      expect(voicingAestheticFor(id, 'pro')).toBe(VOICING_AESTHETICS.proOpen);
    }
  });

  it('free tier (explicit or default) keeps the feel map = no regression', () => {
    expect(voicingAestheticFor('relaxed', 'free')).toBe(VOICING_AESTHETICS.warmLow);
    expect(voicingAestheticFor('driving', 'free')).toBe(VOICING_AESTHETICS.brightOpen);
    expect(voicingAestheticFor('natural', 'free')).toBe(voicingAestheticFor('natural'));
  });
});

describe('default path — no regression', () => {
  it('balanced (and omitting options) reproduces the current output exactly', () => {
    const base = progressionToChordSpecs(PROG, KEY);
    const explicitBalanced = progressionToChordSpecs(PROG, KEY, VOICING_AESTHETICS.balanced);
    expect(explicitBalanced).toEqual(base);
  });
});

describe('named presets respect their register window and relative centre', () => {
  const balanced = progressionToChordSpecs(PROG, KEY, VOICING_AESTHETICS.balanced);
  const warmLow = progressionToChordSpecs(PROG, KEY, VOICING_AESTHETICS.warmLow);
  const brightOpen = progressionToChordSpecs(PROG, KEY, VOICING_AESTHETICS.brightOpen);

  const proOpen = progressionToChordSpecs(PROG, KEY, VOICING_AESTHETICS.proOpen);

  it('every body note stays within each preset floor/ceil', () => {
    for (const [specs, opt] of [
      [warmLow, VOICING_AESTHETICS.warmLow],
      [brightOpen, VOICING_AESTHETICS.brightOpen],
      [proOpen, VOICING_AESTHETICS.proOpen],
    ] as const) {
      for (const spec of specs) {
        for (const n of bodyNotes(spec)) {
          expect(n).toBeGreaterThanOrEqual(opt.floorMidi);
          expect(n).toBeLessThanOrEqual(opt.ceilMidi);
        }
      }
    }
  });

  it('warmLow sits no higher than balanced; brightOpen no lower; bright > warm', () => {
    const warm = meanBody(warmLow);
    const mid = meanBody(balanced);
    const bright = meanBody(brightOpen);
    expect(warm).toBeLessThanOrEqual(mid + 1e-9);
    expect(bright).toBeGreaterThanOrEqual(mid - 1e-9);
    expect(bright).toBeGreaterThan(warm); // the two aesthetics are audibly distinct
  });

  it('proOpen (pro tier) lifts the voicing above balanced and differs from it', () => {
    expect(meanBody(proOpen)).toBeGreaterThan(meanBody(balanced));
    expect(proOpen).not.toEqual(balanced);
  });

  it('is deterministic (same options ⇒ identical specs)', () => {
    expect(progressionToChordSpecs(PROG, KEY, VOICING_AESTHETICS.warmLow)).toEqual(warmLow);
  });
});
