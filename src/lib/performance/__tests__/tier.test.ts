/**
 * Monetization tier → performance strength.
 *
 * Guarantees the product contract: `free` is the EXACT identity (a free render is
 * byte-identical to the pre-tier / no-options output — no regression), while `pro`
 * audibly boosts the humanize feel (wider strum roll, wider timing) without changing
 * which notes are played or breaking determinism.
 */

import { generatePerformance } from '@/lib/performance/PerformanceEngine';
import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import { tierProfile } from '@/lib/performance/tier';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
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

const PROG: ChordEvent[] = [ev(0, 'maj7'), ev(5, 'maj7'), ev(7, '7'), ev(9, 'm7')];

function render(opts: { humanizeBoost?: number; strumScale?: number }) {
  const chords = progressionToPerfChords(PROG, KEY);
  return generatePerformance(
    { chords, bpm: 100, seed: 77 },
    { styleId: 'natural', grooveId: 'pop8', drums: false, ...opts },
  );
}

/** Largest onset spread within any single chord strike (strum roll width). */
function maxStrikeSpread(notes: NoteEvent[]): number {
  const groups = new Map<number, number[]>();
  for (const n of notes) {
    if (n.trackId !== 'chord') continue;
    const g = Math.round(n.timeBeat * 4) / 4; // cluster a strike's notes
    groups.set(g, [...(groups.get(g) ?? []), n.timeBeat]);
  }
  let max = 0;
  for (const times of groups.values()) {
    if (times.length > 1) max = Math.max(max, Math.max(...times) - Math.min(...times));
  }
  return max;
}

describe('tierProfile — pure mapping', () => {
  it('free is the exact identity (multipliers = 1)', () => {
    expect(tierProfile('free')).toEqual({ humanizeBoost: 1, strumScale: 1 });
  });

  it('pro boosts humanize and strum above free', () => {
    const pro = tierProfile('pro');
    expect(pro.humanizeBoost).toBeGreaterThan(1);
    expect(pro.strumScale).toBeGreaterThan(1);
  });
});

describe('engine — free tier = no regression', () => {
  it('omitting the tier options equals free (humanizeBoost/strumScale = 1)', () => {
    const noOpts = render({});
    const explicitFree = render({ humanizeBoost: 1, strumScale: 1 });
    expect(explicitFree).toEqual(noOpts);
  });
});

describe('engine — pro tier is audibly richer but structurally identical', () => {
  const free = render(tierProfile('free'));
  const pro = render(tierProfile('pro'));

  it('plays the same notes (same count + pitch multiset)', () => {
    expect(pro).toHaveLength(free.length);
    const pitches = (e: NoteEvent[]) => e.map((n) => n.pitch).sort((a, b) => a - b);
    expect(pitches(pro)).toEqual(pitches(free));
  });

  it('differs from free (timing/strum humanized)', () => {
    expect(pro).not.toEqual(free);
  });

  it('rolls the chord wider (pro strum spread > free)', () => {
    expect(maxStrikeSpread(pro)).toBeGreaterThan(maxStrikeSpread(free));
  });

  it('is deterministic (same tier ⇒ identical output)', () => {
    expect(render(tierProfile('pro'))).toEqual(pro);
  });
});
