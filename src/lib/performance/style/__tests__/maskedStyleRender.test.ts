/**
 * Gates for per-chord STYLE rendering.
 *
 * The central claim is stronger than "mixed output looks reasonable": every chord
 * must sound EXACTLY as it does when the whole project plays that one STYLE. That
 * single equality is what proves phrase index, absolute beat and RNG sequence are
 * untouched, and it is why a progression with no override is byte-identical.
 */

import { canonicalMidiEventPriority } from '@/lib/midiExport/eventOrdering';
import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import { snapshotSignature, snapshotToMidiEvents } from '@/lib/playback/nativePlaybackPlan';
import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
} from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { InstrumentEffect } from '@/lib/performance/effect';
import type { HarmonyCollisionViolation } from '@/lib/performance/harmonyCollision';
import { allowedPcsFor } from '@/lib/performance/harmonyGate';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import type { PerfChord } from '@/lib/performance/PerformanceEngine';
import {
  chordStyleKey,
  harmonyOwnerChordIndex,
  PUBLIC_CHORD_STYLES,
  renderOwnerChordIndex,
  type EffectiveChordStyle,
} from '@/lib/performance/style';
import { performanceSeedFromSession } from '@/services/audio/performanceMapper';
import type { ChordDuration, ChordEvent } from '@/types';

const BLOCK: EffectiveChordStyle = { pattern: 'block', variant: 'block.type1' };
const NATURAL1: EffectiveChordStyle = { pattern: 'natural', variant: 'natural.type1' };
const NATURAL2: EffectiveChordStyle = { pattern: 'natural', variant: 'natural.type2' };
const CITY: EffectiveChordStyle = { pattern: 'city', variant: 'city.type1' };
const ARPEGGIO: EffectiveChordStyle = { pattern: 'natural', variant: 'natural.type5' };
const DANCE: EffectiveChordStyle = { pattern: 'natural', variant: 'natural.dance1' };

const EPS = 1e-9;
const GOLDEN_A = GOLDEN_PROGRESSIONS.find((p) => p.id === 'A')!;

function session(
  chords: ChordEvent[],
  global: EffectiveChordStyle,
  bpm = GOLDEN_A.bpm,
): PerformanceSessionInput {
  return {
    key: GOLDEN_A.key,
    tempoBpm: bpm,
    grooveId: 'pop8',
    accompanimentPattern: global.pattern,
    accompanimentVariant: global.variant,
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift: 0,
    releaseCut: false,
    instrumentEffect: 'sustain',
    drumMode: 'off',
    progression: chords,
  };
}

/** Assign a STYLE per chord; `undefined` leaves the chord inheriting the project. */
function withOverrides(
  chords: readonly ChordEvent[],
  overrides: readonly (EffectiveChordStyle | undefined)[],
): ChordEvent[] {
  return chords.map((chord, index) => {
    const override = overrides[index];
    return override ? { ...chord, accompanimentOverride: { ...override } } : { ...chord };
  });
}

function durations(chords: readonly ChordEvent[], beats: readonly ChordDuration[]): ChordEvent[] {
  return chords.map((chord, index) => ({ ...chord, durationBeats: beats[index] ?? 4 }));
}

function noteKey(note: NoteEvent): string {
  return [
    note.timeBeat.toFixed(6),
    note.durationBeat.toFixed(6),
    note.pitch,
    note.velocity,
    note.trackId,
    note.articulation,
    note.rrIndex,
    note.ownerChordIndex ?? '-',
    note.harmonyTargetChordIndex ?? '-',
  ].join(':');
}

/** Performance identity excluding the written NoteOff, which a STYLE boundary may trim. */
function noteIdentityKey(note: NoteEvent): string {
  return [
    note.timeBeat.toFixed(6),
    note.pitch,
    note.velocity,
    note.trackId,
    note.articulation,
    note.rrIndex,
    note.ownerChordIndex ?? '-',
    note.harmonyTargetChordIndex ?? '-',
  ].join(':');
}

function chordEnd(chord: PerfChord): number {
  return chord.startBeat + chord.durationBeats;
}

/** Exact collision identity required by the short-boundary baseline comparison. */
function collisionKey(reject: HarmonyCollisionViolation): string {
  return [
    reject.ruleId,
    reject.chordSymbol,
    reject.beatPosition.toFixed(6),
    reject.midiA,
    reject.midiB ?? '-',
  ].join(':');
}

describe('no-override projects are unchanged', () => {
  it.each(GOLDEN_PROGRESSIONS)('$id keeps its Final MIDI signature for every STYLE', (golden) => {
    for (const style of [BLOCK, NATURAL1, NATURAL2, CITY, ARPEGGIO, DANCE]) {
      const bare = buildSessionPerformancePlan(
        { ...session(golden.chords, style), key: golden.key, tempoBpm: golden.bpm },
        'free',
      );
      // An override naming the project STYLE must collapse to the identity mask.
      const redundant = buildSessionPerformancePlan(
        {
          ...session(
            withOverrides(
              golden.chords,
              golden.chords.map(() => style),
            ),
            style,
          ),
          key: golden.key,
          tempoBpm: golden.bpm,
        },
        'free',
      );
      expect(snapshotSignature(buildFinalMidiSnapshot(redundant))).toBe(
        snapshotSignature(buildFinalMidiSnapshot(bare)),
      );
      expect(redundant.notes.map(noteKey)).toEqual(bare.notes.map(noteKey));
    }
  });

  it('renders an empty progression', () => {
    const plan = buildSessionPerformancePlan(session([], NATURAL1), 'free');
    expect(plan.notes).toEqual([]);
    expect(plan.totalBeats).toBe(0);
  });

  it('keeps the project seed free of override information', () => {
    const fingerprint = (chords: ChordEvent[]) =>
      performanceSeedFromSession({
        key: GOLDEN_A.key,
        tempoBpm: GOLDEN_A.bpm,
        grooveId: 'pop8',
        accompanimentPattern: NATURAL1.pattern,
        accompanimentVariant: NATURAL1.variant,
        instrumentId: 'piano',
        progression: chords,
      });
    const mixed = withOverrides(GOLDEN_A.chords, [undefined, CITY, BLOCK, undefined]);
    expect(fingerprint(mixed)).toBe(fingerprint([...GOLDEN_A.chords]));
  });
});

describe('Shared Base pitch is independent of STYLE', () => {
  it('resolves the same voicing whatever each chord plays', () => {
    const base = (chords: ChordEvent[]) =>
      buildSessionPerformancePlan(session(chords, NATURAL1), 'free').chords.map(
        (chord) => `${chord.bassMidi.join(',')}/${chord.bodyMidi.join(',')}`,
      );
    const reference = base([...GOLDEN_A.chords]);
    for (const overrides of [
      [BLOCK, NATURAL2, CITY, ARPEGGIO],
      [CITY, CITY, BLOCK, BLOCK],
      [undefined, DANCE, undefined, CITY],
    ] as const) {
      expect(base(withOverrides(GOLDEN_A.chords, overrides))).toEqual(reference);
    }
  });
});

describe('each chord sounds exactly as it does under a single STYLE', () => {
  /**
   * The reference render must share the project seed, which is derived from the
   * GLOBAL style (and deliberately knows nothing about overrides). Overriding every
   * chord to one STYLE leaves a single distinct STYLE, so this is a full-progression
   * render of that STYLE at the seed the mixed project actually uses.
   */
  function referencePlan(chords: readonly ChordEvent[], style: EffectiveChordStyle) {
    return buildSessionPerformancePlan(
      session(
        withOverrides(
          chords,
          chords.map(() => style),
        ),
        NATURAL1,
      ),
      'free',
    );
  }

  /**
   * Compare a mixed render chord by chord against single-STYLE renders. The only
   * permitted difference is a discarded boundary-crossing anticipation.
   */
  function expectPerChordParity(
    chords: readonly ChordEvent[],
    overrides: readonly (EffectiveChordStyle | undefined)[],
  ) {
    const assigned = overrides.map((override) => override ?? NATURAL1);
    const mixed = buildSessionPerformancePlan(
      session(withOverrides(chords, overrides), NATURAL1),
      'free',
    );
    const cache = new Map<string, ReturnType<typeof referencePlan>>();

    assigned.forEach((style, index) => {
      const key = `${style.pattern}/${style.variant}`;
      const reference = cache.get(key) ?? referencePlan(chords, style);
      cache.set(key, reference);

      const expected = reference.notes
        .filter((note) => renderOwnerChordIndex(reference.chords, note) === index)
        .filter((note) => {
          const harmony = harmonyOwnerChordIndex(reference.chords, note);
          if (harmony === index) return true;
          const target = assigned[harmony];
          return target != null && `${target.pattern}/${target.variant}` === key;
        })
        .map(noteIdentityKey)
        .sort();

      const actual = mixed.notes
        .filter((note) => renderOwnerChordIndex(mixed.chords, note) === index)
        .map(noteIdentityKey)
        .sort();
      expect(actual).toEqual(expected);
    });
  }

  it.each([
    ['Block to Natural', [BLOCK, NATURAL1, NATURAL1, NATURAL1]],
    ['Natural to City', [NATURAL1, NATURAL1, CITY, CITY]],
    ['City to Arpeggio', [CITY, CITY, ARPEGGIO, ARPEGGIO]],
    ['same STYLE throughout', [NATURAL1, NATURAL1, NATURAL1, NATURAL1]],
    ['one chord alone', [undefined, undefined, CITY, undefined]],
    ['every chord different', [BLOCK, NATURAL2, CITY, ARPEGGIO]],
    ['Dance beside another STYLE', [DANCE, DANCE, BLOCK, CITY]],
    ['another STYLE before Dance', [CITY, BLOCK, DANCE, DANCE]],
  ] as readonly [string, readonly (EffectiveChordStyle | undefined)[]][])(
    '%s',
    (_label, overrides) => {
      expectPerChordParity(GOLDEN_A.chords, overrides);
    },
  );

  it.each([
    ['one beat', [1, 1, 1, 1] as ChordDuration[]],
    ['two beats', [2, 2, 2, 2] as ChordDuration[]],
    ['four beats', [4, 4, 4, 4] as ChordDuration[]],
    ['mixed lengths', [1, 2, 4, 1] as ChordDuration[]],
  ])('holds at %s chord boundaries', (_label, beats) => {
    expectPerChordParity(durations(GOLDEN_A.chords, beats), [BLOCK, NATURAL1, CITY, ARPEGGIO]);
  });
});

describe('STYLE boundary contracts', () => {
  const MIXED = [BLOCK, DANCE, CITY, ARPEGGIO] as const;

  function mixedPlan(beats: readonly ChordDuration[] = [4, 4, 4, 4]) {
    return buildSessionPerformancePlan(
      session(withOverrides(durations(GOLDEN_A.chords, beats), MIXED), NATURAL1),
      'free',
    );
  }

  it('lets no attack voice a chord played in another STYLE', () => {
    for (const beats of [
      [4, 4, 4, 4],
      [2, 2, 2, 2],
      [1, 1, 1, 1],
    ] as ChordDuration[][]) {
      const plan = mixedPlan(beats);
      const crossing = plan.notes.filter((note) => {
        const render = renderOwnerChordIndex(plan.chords, note);
        const harmony = harmonyOwnerChordIndex(plan.chords, note);
        return render !== harmony && MIXED[render] !== MIXED[harmony];
      });
      expect(crossing).toEqual([]);
    }
  });

  /**
   * Dance is the only public STYLE that anticipates: a two-beat chord in the first
   * half of a bar pushes the 1.75 attack onto the next chord. That is the one case
   * the boundary rule has to act on, so it is tested where it actually occurs rather
   * than on four-beat chords, where Dance produces no anticipation at all.
   */
  describe('Dance anticipation', () => {
    const HALVES = [2, 2, 2, 2] as ChordDuration[];

    function crossings(overrides: readonly (EffectiveChordStyle | undefined)[]) {
      const assigned = overrides.map((override) => override ?? NATURAL1);
      const plan = buildSessionPerformancePlan(
        session(withOverrides(durations(GOLDEN_A.chords, HALVES), overrides), NATURAL1),
        'free',
      );
      const pairs = plan.notes
        .map((note) => ({
          render: renderOwnerChordIndex(plan.chords, note),
          harmony: harmonyOwnerChordIndex(plan.chords, note),
          note,
        }))
        .filter((entry) => entry.render !== entry.harmony);
      const key = (index: number) => `${assigned[index]?.pattern}/${assigned[index]?.variant}`;
      return {
        sameStyle: pairs.filter((entry) => key(entry.render) === key(entry.harmony)),
        acrossStyles: pairs.filter((entry) => key(entry.render) !== key(entry.harmony)),
      };
    }

    it('crosses the chord boundary when Dance owns both sides', () => {
      const result = crossings([DANCE, DANCE, DANCE, DANCE]);
      expect(result.sameStyle.length).toBeGreaterThan(0);
      expect(result.acrossStyles).toEqual([]);
    });

    it.each([
      ['City', CITY],
      ['Block', BLOCK],
      ['Arpeggio', ARPEGGIO],
      ['Natural Type 2', NATURAL2],
    ])('is discarded when the next chord plays %s', (_label, next) => {
      const result = crossings([DANCE, next, DANCE, DANCE]);
      expect(result.acrossStyles).toEqual([]);
      // The untouched Dance-to-Dance boundary later in the progression still pushes,
      // so the rule removes only the boundary it must.
      expect(result.sameStyle.length).toBeGreaterThan(0);
    });
  });

  it('places NoteOff at or before every STYLE boundary', () => {
    for (const beats of [
      [4, 4, 4, 4],
      [2, 2, 2, 2],
      [1, 1, 1, 1],
    ] as ChordDuration[][]) {
      const plan = mixedPlan(beats);
      for (const note of plan.notes) {
        const ownerIndex = renderOwnerChordIndex(plan.chords, note);
        const owner = plan.chords[ownerIndex]!;
        expect(note.timeBeat + note.durationBeat).toBeLessThanOrEqual(chordEnd(owner) + EPS);
      }
      // Block's authored hold is longer than a short chord, so this proves the
      // boundary layer—not the provider—created the exact NoteOff.
      const firstBoundary = plan.chords[1]!.startBeat;
      if (firstBoundary < 4) {
        expect(
          plan.notes.some(
            (note) =>
              renderOwnerChordIndex(plan.chords, note) === 0 &&
              Math.abs(note.timeBeat + note.durationBeat - firstBoundary) <= EPS,
          ),
        ).toBe(true);
      }
    }
  });

  it('never carries a bass approach across a STYLE boundary', () => {
    for (const beats of [
      [4, 4, 4, 4],
      [2, 2, 2, 2],
      [1, 1, 1, 1],
    ] as ChordDuration[][]) {
      const plan = mixedPlan(beats);
      const bass = plan.notes.filter((note) => note.trackId === 'bass');
      for (const note of bass) {
        const owner = plan.chords[renderOwnerChordIndex(plan.chords, note)]!;
        expect(allowedPcsFor(owner)).toContain(((note.pitch % 12) + 12) % 12);
        expect(note.timeBeat + note.durationBeat).toBeLessThanOrEqual(chordEnd(owner) + EPS);
      }
    }
  });

  it('holds the loop terminal invariant', () => {
    for (const beats of [
      [4, 4, 4, 4],
      [2, 2, 2, 2],
      [1, 1, 1, 1],
    ] as ChordDuration[][]) {
      const snapshot = buildFinalMidiSnapshot(mixedPlan(beats));
      for (const note of snapshot.notes) {
        expect(note.startBeat + note.durationBeat).toBeLessThanOrEqual(snapshot.totalBeats + EPS);
      }
      const pedal = snapshot.controlChanges
        .filter((event) => event.controller === 64)
        .sort((a, b) => a.startBeat - b.startBeat);
      const last = pedal.at(-1);
      if (last) {
        expect(last.startBeat).toBeLessThanOrEqual(snapshot.totalBeats + EPS);
        expect(last.value).toBeLessThan(64);
      }
    }
  });

  it('keeps the canonical order on every shared tick', () => {
    for (const beats of [
      [4, 4, 4, 4],
      [2, 2, 2, 2],
      [1, 1, 1, 1],
    ] as ChordDuration[][]) {
      const events = snapshotToMidiEvents(buildFinalMidiSnapshot(mixedPlan(beats)));
      for (let i = 1; i < events.length; i += 1) {
        const previous = events[i - 1]!;
        const current = events[i]!;
        if (Math.abs(previous.beat - current.beat) > EPS) {
          expect(previous.beat).toBeLessThan(current.beat);
          continue;
        }
        expect(
          canonicalMidiEventPriority(previous.kind, previous.a, previous.b),
        ).toBeLessThanOrEqual(canonicalMidiEventPriority(current.kind, current.a, current.b));
      }
    }
  });

  it('keeps every chord audible at every chord length', () => {
    for (const beats of [
      [4, 4, 4, 4],
      [2, 2, 2, 2],
      [1, 1, 1, 1],
    ] as ChordDuration[][]) {
      const plan = mixedPlan(beats);
      plan.chords.forEach((chord) => {
        const audible = plan.notes.some(
          (note) =>
            (note.trackId === 'chord' || note.trackId === 'top') &&
            note.timeBeat >= chord.startBeat - 0.05 &&
            note.timeBeat < chordEnd(chord) - EPS,
        );
        expect(audible).toBe(true);
      });
    }
  });
});

/**
 * Quality gate on the shipping chord length. Every Golden progression is in whole
 * bars, which is the configuration the collision contract is defined against, so a
 * mixed render must be as clean there as a single STYLE is.
 */
describe('mixed STYLEs stay harmonically clean on whole-bar chords', () => {
  const MIXES: readonly (readonly EffectiveChordStyle[])[] = [
    [BLOCK, NATURAL1, NATURAL1, NATURAL1],
    [NATURAL1, NATURAL1, CITY, CITY],
    [CITY, CITY, ARPEGGIO, ARPEGGIO],
    [BLOCK, NATURAL2, CITY, ARPEGGIO],
    [DANCE, DANCE, BLOCK, CITY],
  ];

  it.each(GOLDEN_PROGRESSIONS)('$id rejects nothing under any mix', (golden) => {
    for (const mix of MIXES) {
      const plan = buildSessionPerformancePlan(
        {
          ...session(
            withOverrides(
              golden.chords,
              golden.chords.map((_, index) => mix[index % mix.length]!),
            ),
            NATURAL1,
          ),
          key: golden.key,
          tempoBpm: golden.bpm,
        },
        'free',
      );
      expect(plan.harmonyViolations).toEqual([]);
      expect(plan.collisionReport?.rejects).toEqual([]);
      expect(plan.collisionReport?.ok).toBe(true);
    }
  });
});

/**
 * Short chords have pre-existing collision debt in some single STYLEs. P1 does not
 * redefine that debt as success, but an override must not add a new collision at a
 * different pitch/chord/beat. Comparing exact identities (not only counts) prevents
 * one reject from being silently traded for another.
 */
describe('short STYLE boundaries add no collision reject to their baseline', () => {
  const EFFECTS: readonly InstrumentEffect[] = ['off', 'sustain', 'releaseCut'];

  it.each([1, 2] as const)(
    '%i-beat chords preserve the exact baseline collision set',
    (duration) => {
      const source = durations(
        GOLDEN_A.chords,
        GOLDEN_A.chords.map(() => duration),
      );

      for (const effect of EFFECTS) {
        for (const global of PUBLIC_CHORD_STYLES) {
          const baseSession = {
            ...session([...source], global),
            releaseCut: effect === 'releaseCut',
            instrumentEffect: effect,
          };
          const baseline = buildSessionPerformancePlan(baseSession, 'free');
          const baselineRejects = new Set(
            (baseline.collisionReport?.rejects ?? []).map(collisionKey),
          );
          const baseVoicing = baseline.chords.map((chord) => ({
            bass: chord.bassMidi,
            body: chord.bodyMidi,
          }));

          for (const override of PUBLIC_CHORD_STYLES) {
            if (chordStyleKey(override) === chordStyleKey(global)) continue;
            for (let index = 0; index < source.length; index += 1) {
              const mixed = buildSessionPerformancePlan(
                {
                  ...baseSession,
                  progression: withOverrides(
                    source,
                    source.map((_, chordIndex) => (chordIndex === index ? override : undefined)),
                  ),
                },
                'free',
              );
              const newRejects = (mixed.collisionReport?.rejects ?? [])
                .map(collisionKey)
                .filter((key) => !baselineRejects.has(key));

              expect({
                duration,
                effect,
                global: chordStyleKey(global),
                override: chordStyleKey(override),
                index,
                newRejects,
              }).toEqual({
                duration,
                effect,
                global: chordStyleKey(global),
                override: chordStyleKey(override),
                index,
                newRejects: [],
              });
              expect(
                mixed.chords.map((chord) => ({
                  bass: chord.bassMidi,
                  body: chord.bodyMidi,
                })),
              ).toEqual(baseVoicing);
            }
          }
        }
      }
    },
  );

  it('off and sustain remain the same written NoteOff schedule', () => {
    const progression = withOverrides(durations(GOLDEN_A.chords, [1, 1, 1, 1]), [
      BLOCK,
      NATURAL2,
      CITY,
      ARPEGGIO,
    ]);
    const render = (effect: InstrumentEffect) =>
      buildSessionPerformancePlan(
        {
          ...session(progression, NATURAL1),
          releaseCut: effect === 'releaseCut',
          instrumentEffect: effect,
        },
        'free',
      );
    expect(render('sustain').notes.map(noteKey)).toEqual(render('off').notes.map(noteKey));
  });
});
