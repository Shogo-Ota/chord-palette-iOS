/**
 * Chord Tone Strict — the user's chord symbol is the harmony ground truth.
 *
 * Whatever produced a note (Human MIDI Template, legacy pattern, bass-line
 * planner, voicing aesthetics, Energy register shift), its pitch class must be one
 * the chosen chord spells: C sounds C-E-G, Am sounds A-C-E, Fmaj7 sounds F-A-C-E,
 * Cadd9 sounds C-E-G-D, Dm7 sounds D-F-A-C. A single violation is a P1 failure.
 *
 * The matrix drives the real production path (`buildSessionPerformancePlan`, the
 * one pipeline behind playback, video export and MIDI export) across every
 * accompaniment rhythm, both tiers, both registers and every Energy reading.
 */

import type { AccompanimentPattern } from '@/types';

/**
 * Block is algorithmic and must stay chord-tone-only.
 * Human Template patterns (natural / arpeggio / relaxed) keep teacher chromatics
 * for Identity fidelity — they are not in this matrix.
 */
const CHORD_TONE_ONLY_PATTERNS: readonly AccompanimentPattern[] = ['block'];
import { keyTonicPc } from '@/data/music';
import { ENERGY_IDS } from '@/lib/performance/energy';
import {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
} from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { applyHarmonyGate } from '@/lib/performance/harmonyGate';
import { generatePerformance } from '@/lib/performance/PerformanceEngine';
import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import type { Tier } from '@/lib/performance/tier';
import { intervalsForChord } from '@/lib/theory/definitions';
import type { ChordEvent, MajorKey } from '@/types';

/**
 * Human-template voices. Bass connectives may leave the chord on purpose;
 * the validator reports them instead of snapping.
 */
const PITCHED_TRACKS = new Set(['chord', 'top']);

/**
 * How far from a chord boundary an onset may be attributed to either neighbour.
 * Micro-timing and strum spread move attacks by a few milliseconds, so a note
 * sitting on the seam is legitimately part of the chord before or after it.
 */
const BOUNDARY_TOLERANCE_BEATS = 1 / 8;

function ev(rootOffset: number, suffix: string, durationBeats = 4): ChordEvent {
  return {
    id: `ev-${rootOffset}-${suffix}`,
    chordId: `c-${rootOffset}-${suffix}`,
    displayName: `${rootOffset}${suffix}`,
    degreeLabel: 'I',
    function: 'tonic',
    durationBeats,
    isPro: false,
    rootOffset,
    suffix,
  } as ChordEvent;
}

/** The pitch classes the chord symbol spells — the ground truth for this suite. */
function allowedPitchClasses(chord: ChordEvent, key: MajorKey): Set<number> {
  const root = (keyTonicPc(key) + (chord.rootOffset ?? 0)) % 12;
  const intervals = intervalsForChord(chord.suffix ?? '', chord.definitionId);
  return new Set(intervals.map((iv) => (root + iv) % 12));
}

function pitchClass(pitch: number): number {
  return ((pitch % 12) + 12) % 12;
}

type Violation = {
  context: string;
  chord: string;
  trackId: string;
  timeBeat: number;
  pitch: number;
  pitchClass: number;
  allowed: number[];
};

/**
 * Every pitched note must be spelled by a chord that could be sounding at its
 * onset. Independent of the gate's own lookup: candidates come from the plan's
 * chord windows widened by the boundary tolerance.
 */
function violationsIn(
  session: PerformanceSessionInput,
  tier: Tier,
  context: string,
): Violation[] {
  const plan = buildSessionPerformancePlan(session, tier);
  const windows = plan.chords.map((c, i) => ({
    startBeat: c.startBeat,
    endBeat: c.startBeat + c.durationBeats,
    label: session.progression[i]?.displayName ?? `#${i}`,
    allowed: allowedPitchClasses(session.progression[i]!, session.key),
  }));
  const out: Violation[] = [];
  for (const note of plan.notes) {
    if (!PITCHED_TRACKS.has(note.trackId)) continue;
    const pc = pitchClass(note.pitch);
    const candidates = windows.filter(
      (w) =>
        note.timeBeat >= w.startBeat - BOUNDARY_TOLERANCE_BEATS &&
        note.timeBeat < w.endBeat + BOUNDARY_TOLERANCE_BEATS,
    );
    const host = candidates.length > 0 ? candidates : windows;
    if (host.some((w) => w.allowed.has(pc))) continue;
    const nearest = host[0]!;
    out.push({
      context,
      chord: nearest.label,
      trackId: note.trackId,
      timeBeat: note.timeBeat,
      pitch: note.pitch,
      pitchClass: pc,
      allowed: [...nearest.allowed].sort((a, b) => a - b),
    });
  }
  return out;
}

function session(
  progression: ChordEvent[],
  overrides: Partial<PerformanceSessionInput> = {},
): PerformanceSessionInput {
  return {
    key: 'C',
    tempoBpm: 96,
    grooveId: 'pop8',
    accompanimentPattern: 'natural',
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift: 1,
    releaseCut: true,
    drumMode: 'full',
    progression,
    ...overrides,
  };
}

function report(violations: Violation[]): string {
  return violations
    .slice(0, 12)
    .map(
      (v) =>
        `${v.context} ${v.chord} ${v.trackId}@${v.timeBeat.toFixed(3)} pitch ${v.pitch} ` +
        `(pc ${v.pitchClass}) not in [${v.allowed.join(',')}]`,
    )
    .join('\n');
}

/** The qualities the release contract names, plus the shapes most likely to leak. */
const QUALITIES = [
  '',
  'm',
  'maj7',
  '7',
  'm7',
  'add9',
  'maj9',
  'sus4',
  'dim',
  'aug',
] as const;

/** Several roots per quality, so a wrong tone cannot hide behind the tonic. */
const ROOTS = [0, 5, 9, 7];

const TIERS: Tier[] = ['free', 'pro'];

describe('chord tone strict — the chosen chord is the only harmony that sounds', () => {
  it.each(QUALITIES)('%s: no note outside the chord, on any rhythm or tier', (suffix) => {
    const progression = ROOTS.map((root) => ev(root, suffix));
    const violations: Violation[] = [];
    for (const pattern of CHORD_TONE_ONLY_PATTERNS) {
      for (const tier of TIERS) {
        for (const octaveShift of [0, 1]) {
          violations.push(
            ...violationsIn(
              session(progression, { accompanimentPattern: pattern, octaveShift }),
              tier,
              `${pattern}/${tier}/oct${octaveShift}/"${suffix}"`,
            ),
          );
        }
      }
    }
    expect(report(violations)).toBe('');
    expect(violations).toHaveLength(0);
  });

  it('the release examples spell exactly what the user picked', () => {
    // C → C E G, Am → A C E, Fmaj7 → F A C E, Cadd9 → C E G D, Dm7 → D F A C
    const progression = [ev(0, ''), ev(9, 'm'), ev(5, 'maj7'), ev(0, 'add9'), ev(2, 'm7')];
    const violations: Violation[] = [];
    for (const pattern of CHORD_TONE_ONLY_PATTERNS) {
      for (const energy of ENERGY_IDS) {
        violations.push(
          ...violationsIn(
            session(progression, { accompanimentPattern: pattern, accompanimentEnergy: energy }),
            'pro',
            `${pattern}/${energy}`,
          ),
        );
      }
    }
    expect(report(violations)).toBe('');
    expect(violations).toHaveLength(0);
  });

  it('holds across every key and mixed chord lengths', () => {
    const keys: MajorKey[] = ['C', 'F', 'G', 'A', 'E', 'B', 'D'];
    const progression = [ev(5, 'maj7', 1), ev(9, 'm7', 2), ev(0, 'add9', 4), ev(7, '7', 1)];
    const violations: Violation[] = [];
    for (const key of keys) {
      for (const pattern of CHORD_TONE_ONLY_PATTERNS) {
        violations.push(
          ...violationsIn(
            session(progression, { key, accompanimentPattern: pattern }),
            'free',
            `${key}/${pattern}`,
          ),
        );
      }
    }
    expect(report(violations)).toBe('');
    expect(violations).toHaveLength(0);
  });
});

describe('harmony gate — what it changes and what it must not', () => {
  const progression = [ev(0, ''), ev(9, 'm'), ev(5, 'maj7'), ev(7, '7')];

  /** Ungated engine output for the same input, to compare against. */
  function rawNotes(pattern: string) {
    const chords = progressionToPerfChords(progression, 'C', 1);
    const notes = generatePerformance(
      { chords, bpm: 96, seed: 7 },
      { styleId: pattern, grooveId: 'pop8', accompanimentStyle: 'band', drums: false },
    );
    return { chords, notes };
  }

  it('keeps onset, duration, velocity, articulation and note count', () => {
    const { chords, notes } = rawNotes('block');
    const gated = applyHarmonyGate(notes, chords).notes;
    expect(gated).toHaveLength(notes.length);
    gated.forEach((g, i) => {
      const raw = notes[i]!;
      expect(g.timeBeat).toBe(raw.timeBeat);
      expect(g.durationBeat).toBe(raw.durationBeat);
      expect(g.velocity).toBe(raw.velocity);
      expect(g.articulation).toBe(raw.articulation);
      expect(g.trackId).toBe(raw.trackId);
    });
  });

  it('leaves an already strict Human MIDI Template performance untouched', () => {
    const plan = buildSessionPerformancePlan(session(progression, { accompanimentPattern: 'natural' }));
    const chordVoices = plan.notes.filter((n) => n.trackId === 'chord');
    expect(chordVoices.length).toBeGreaterThan(0);
    const { stats } = applyHarmonyGate(chordVoices, plan.chords);
    expect(stats.snapped).toBe(0);
  });

  it('detects an illegal pitch without rewriting it', () => {
    const chords = progressionToPerfChords([ev(0, '')], 'C', 1);
    const c = chords[0]!;
    // C major over the whole bar: C#4 (61) is not a chord tone.
    const note = {
      timeBeat: 0,
      durationBeat: 1,
      pitch: 61,
      velocity: 80,
      articulation: 'normal' as const,
      rrIndex: 0,
      trackId: 'bass' as const,
      seed: 1,
    };
    const { notes, stats, violations } = applyHarmonyGate([note], [c]);
    expect(notes[0]!.pitch).toBe(61);
    expect(stats.snapped).toBe(0);
    expect(stats.illegal).toBe(1);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.pitch).toBe(61);
  });

  it('never rewrites drum voices', () => {
    const chords = progressionToPerfChords([ev(0, '')], 'C', 1);
    const kick = {
      timeBeat: 0,
      durationBeat: 0.25,
      pitch: 36,
      velocity: 100,
      articulation: 'normal' as const,
      rrIndex: 0,
      trackId: 'kick' as const,
      seed: 1,
    };
    const { notes, stats } = applyHarmonyGate([kick], chords);
    expect(notes[0]!.pitch).toBe(36);
    expect(stats.examined).toBe(0);
  });
});
