/**
 * Fixed material for playback A/B comparison.
 *
 * Every comparison between the old and new engines must use the SAME Final MIDI,
 * otherwise a difference in sound could come from the generation layer instead of the
 * playback layer. These fixtures are that fixed input: one musical progression rendered
 * through the real pipeline, plus four synthetic snapshots that isolate a single
 * playback property each.
 *
 * The synthetic snapshots are hand-built rather than generated on purpose — they must
 * not change when the generation layer changes, or the audio tests stop being a
 * measurement of playback.
 *
 * Pure domain data. No RN/Expo imports.
 */

import type { PerformanceSessionInput } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import type { FinalMidiSnapshot } from '@/lib/performance/finalMidi/types';
import type { AccompanimentPattern, ChordEvent } from '@/types';

/** Fixed tempo for every playback comparison. */
export const PLAYBACK_TEST_BPM = 90;

/** Seconds per beat at {@link PLAYBACK_TEST_BPM} — 0.667 s. */
const SPB = 60 / PLAYBACK_TEST_BPM;

function chord(displayName: string, rootOffset: number, suffix: string, index: number): ChordEvent {
  return {
    id: `playback-test-${index}`,
    chordId: `playback-test-${displayName}`,
    displayName,
    degreeLabel: '',
    function: 'tonic',
    durationBeats: 4,
    isPro: false,
    rootOffset,
    suffix,
  };
}

/**
 * The fixed A/B progression: C | Am | Fmaj7 | G7 in C, one bar each.
 * Covers a plain triad, a minor triad, a major seventh and a dominant seventh, so a
 * wrong-pitch or wrong-voicing regression shows up on at least one chord.
 */
export const PLAYBACK_TEST_PROGRESSION: readonly ChordEvent[] = [
  chord('C', 0, '', 0),
  chord('Am', 9, 'm', 1),
  chord('Fmaj7', 5, 'maj7', 2),
  chord('G7', 7, '7', 3),
];

/**
 * The fixed session for a playback comparison: piano, drums off, effect off, no octave
 * shift, at {@link PLAYBACK_TEST_BPM}. Only the pattern and Type vary, so a difference
 * between two takes is a difference in the pattern — nothing else.
 */
export function playbackTestSessionInput(
  accompanimentPattern: AccompanimentPattern,
  accompanimentVariant?: string,
): PerformanceSessionInput {
  return {
    key: 'C',
    tempoBpm: PLAYBACK_TEST_BPM,
    grooveId: 'pop8',
    accompanimentPattern,
    accompanimentVariant: accompanimentVariant as PerformanceSessionInput['accompanimentVariant'],
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift: 0,
    releaseCut: false,
    instrumentEffect: 'off',
    drumMode: 'off',
    drumBeat: '8',
    progression: [...PLAYBACK_TEST_PROGRESSION],
  };
}

function emptySnapshot(overrides: Partial<FinalMidiSnapshot>): FinalMidiSnapshot {
  return {
    bpm: PLAYBACK_TEST_BPM,
    beatsPerBar: 4,
    timeSignature: { numerator: 4, denominator: 4 },
    totalBeats: 8,
    instrumentId: 'piano',
    gmProgram: 0,
    drumMode: 'off',
    notes: [],
    controlChanges: [],
    markers: [],
    ...overrides,
  };
}

function note(
  startBeat: number,
  durationBeat: number,
  pitch: number,
  velocity: number,
): FinalMidiSnapshot['notes'][number] {
  return { startBeat, durationBeat, pitch, velocity, channel: 0, track: 'accompaniment' };
}

/**
 * Test A — one C4 at four velocities. The question it answers: does the voice change
 * TIMBRE with velocity, or only volume? v1 cannot, by construction: it captures every
 * note once at velocity 100 and scales the amplitude.
 */
export function velocityTestSnapshot(): FinalMidiSnapshot {
  return emptySnapshot({
    totalBeats: 8,
    notes: [30, 60, 90, 120].map((velocity, i) => note(i * 2, 1.5, 60, velocity)),
  });
}

/**
 * Test D — the same pitch held for 0.25, 1, 4 and 6 beats. At 90 BPM the 6-beat note is
 * 4 s, past v1's 3 s captured tail, so a note dropping out mid-hold is audible here and
 * nowhere else. 8 beats of lead-out leaves room for the release.
 */
export function durationTestSnapshot(): FinalMidiSnapshot {
  const spans = [0.25, 1, 4, 6];
  let at = 0;
  const notes = spans.map((durationBeat) => {
    const n = note(at, durationBeat, 60, 90);
    at += durationBeat + 2;
    return n;
  });
  return emptySnapshot({ totalBeats: at + 4, notes });
}

/**
 * Test E — the same three-note chord played twice: once under a held pedal, once dry.
 * v1 never sees CC64 (the sampler is not in the signal path), so both bars sound
 * identical; a sampler that receives the controller sustains the first one.
 */
export function sustainTestSnapshot(): FinalMidiSnapshot {
  const pedalled = [60, 64, 67].map((pitch) => note(0, 0.5, pitch, 80));
  const dry = [60, 64, 67].map((pitch) => note(8, 0.5, pitch, 80));
  return emptySnapshot({
    totalBeats: 16,
    notes: [...pedalled, ...dry],
    controlChanges: [
      { startBeat: 0, controller: 64, value: 127, channel: 0 },
      { startBeat: 6, controller: 64, value: 0, channel: 0 },
    ],
  });
}

/**
 * Test F — 18 notes struck together and held. Above v1's polyphony cap of 24 voices
 * once tails overlap, and the case where summing pre-rendered buffers hits the soft
 * clipper hardest.
 */
export function polyphonyTestSnapshot(): FinalMidiSnapshot {
  const pitches = Array.from({ length: 18 }, (_, i) => 36 + i * 3);
  return emptySnapshot({
    totalBeats: 8,
    notes: pitches.map((pitch, i) => note(0, 4, pitch, 60 + (i % 4) * 15)),
  });
}

/** Seconds a note of `beats` lasts at the fixed test tempo. */
export function testSeconds(beats: number): number {
  return beats * SPB;
}
