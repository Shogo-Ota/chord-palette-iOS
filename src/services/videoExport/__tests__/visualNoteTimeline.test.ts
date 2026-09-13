import { buildExportPlan } from '@/lib/exportPlan';
import type { NoteEvent, TrackId } from '@/lib/performance/NoteEvent';
import type { PerfChord } from '@/lib/performance/PerformanceEngine';
import type { SessionPerformancePlan } from '@/lib/performance/finalMidi/types';
import { goldenProgressionById } from '@/lib/midiQa/goldenProgressions';
import {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
} from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { buildVideoAudioRequest } from '../buildVideoAudioRequest';
import { buildVisualNoteTimeline } from '../visualNoteTimeline';

function note(
  trackId: TrackId,
  pitch: number,
  timeBeat: number,
  durationBeat = 1,
  velocity = 96,
): NoteEvent {
  return {
    trackId,
    pitch,
    timeBeat,
    durationBeat,
    velocity,
    articulation: 'normal',
    rrIndex: 0,
    seed: 42,
  };
}

/** Two four-beat chords so harmony ownership can be asserted around a boundary. */
const TWO_CHORDS: PerfChord[] = [
  { bodyMidi: [60, 64, 67], bassMidi: [48], startBeat: 0, durationBeats: 4 },
  { bodyMidi: [62, 65, 69], bassMidi: [50], startBeat: 4, durationBeats: 4 },
];

function performance(
  notes: NoteEvent[],
  bpm = 120,
  totalBeats = 4,
  chords: PerfChord[] = [],
): SessionPerformancePlan {
  return {
    notes,
    chords,
    progression: [],
    bpm,
    totalBeats,
    beatsPerBar: 4,
    drumPatternId: 'pop8',
    instrumentId: 'piano',
    drumMode: 'off',
    instrumentEffect: 'releaseCut',
    seed: 42,
  };
}

function generatedPerformance(
  progressionId: 'A' | 'D' | 'F',
  variant: PerformanceSessionInput['accompanimentVariant'],
  repeatProgression = false,
): SessionPerformancePlan {
  const fixture = goldenProgressionById(progressionId);
  return buildSessionPerformancePlan(
    {
      key: fixture.key,
      tempoBpm: fixture.bpm,
      grooveId: 'pop8',
      accompanimentPattern: variant?.startsWith('block.') ? 'block' : 'natural',
      accompanimentVariant: variant,
      instrumentId: 'piano',
      accompanimentEnergy: 'build',
      octaveShift: 0,
      releaseCut: false,
      instrumentEffect: 'releaseCut',
      drumMode: 'off',
      progression: repeatProgression
        ? [...fixture.chords, ...fixture.chords.map((chord) => ({ ...chord, id: `${chord.id}-2` }))]
        : fixture.chords,
    },
    'free',
  );
}

describe('Flow VisualNoteTimeline', () => {
  it('emits only finalized chord and top notes with the minimal schema', () => {
    const plan = performance([
      note('bass', 36, 0),
      note('kick', 36, 0),
      note('chord', 60, 0),
      note('top', 72, 0.5, 0.75, 110),
    ]);

    expect(buildVisualNoteTimeline(plan, 2)).toEqual([
      { pitch: 60, startSec: 0, durationSec: 0.5, velocity: 96, harmonyStartSec: 0 },
      { pitch: 72, startSec: 0.25, durationSec: 0.375, velocity: 110, harmonyStartSec: 0.25 },
    ]);
  });

  it('uses Final MIDI minimum duration and deterministic event ordering', () => {
    const plan = performance([
      note('top', 72, 1, 0),
      note('chord', 67, 0, 1),
      note('chord', 60, 0, 1),
    ]);
    const timeline = buildVisualNoteTimeline(plan, 2);

    expect(timeline.map(({ startSec, pitch }) => [startSec, pitch])).toEqual([
      [0, 60],
      [0, 67],
      [0.5, 72],
    ]);
    expect(timeline[2].durationSec).toBe((1 / 64) * (60 / plan.bpm));
    expect(Object.isFrozen(timeline)).toBe(true);
    expect(timeline.every(Object.isFrozen)).toBe(true);
  });

  it('does not mutate or regenerate the authoritative performance plan', () => {
    const plan = performance([note('chord', 60, -0.02, 2), note('top', 72, 1)]);
    const before = structuredClone(plan);
    const audioBefore = buildVideoAudioRequest(plan, 2);

    buildVisualNoteTimeline(plan, 2);

    expect(plan).toEqual(before);
    expect(buildVideoAudioRequest(plan, 2)).toEqual(audioBefore);
  });

  it('mirrors the offline renderer frame-zero clamp for an anticipated first note', () => {
    const plan = performance([note('chord', 60, -0.02, 1)], 120);

    expect(buildVisualNoteTimeline(plan, 2)).toEqual([
      { pitch: 60, startSec: 0, durationSec: 0.49, velocity: 96, harmonyStartSec: 0 },
    ]);
  });

  it('does not invent looped notes that are absent from the offline audio schedule', () => {
    const plan = performance([note('chord', 60, 0), note('top', 67, 2)], 120, 4);

    expect(buildVisualNoteTimeline(plan, 4).map((event) => event.startSec)).toEqual([0, 1]);
  });

  it.each([
    ['block chord', 120, [note('chord', 60, 0), note('chord', 64, 0), note('chord', 67, 0)]],
    [
      'arpeggio',
      72,
      [note('chord', 60, 0, 0.5), note('chord', 64, 0.5, 0.5), note('top', 67, 1, 4)],
    ],
    ['high BPM', 220, [note('chord', 61, 0.25, 8)]],
    ['low BPM', 48, [note('top', 73, 0.125, 0.25)]],
  ] as const)('%s landing matches the exact audio note-on/off schedule', (_, bpm, notes) => {
    const plan = performance([...notes], bpm, 8);
    const durationSec = plan.totalBeats * (60 / bpm);
    const timeline = buildVisualNoteTimeline(plan, durationSec);
    const midi = buildVideoAudioRequest(plan, durationSec).midiEvents ?? [];

    for (const visual of timeline) {
      const secondsPerBeat = 60 / bpm;
      const noteOn = midi.find(
        (event) =>
          event.kind === 'on' &&
          !event.drum &&
          event.a === visual.pitch &&
          Math.max(0, event.beat * secondsPerBeat) === visual.startSec,
      );
      const noteOff = midi.find(
        (event) =>
          event.kind === 'off' &&
          !event.drum &&
          event.a === visual.pitch &&
          Math.max(0, event.beat * secondsPerBeat) === visual.startSec + visual.durationSec,
      );

      expect(noteOn?.b).toBe(visual.velocity);
      expect(noteOff).toBeDefined();
    }
  });

  it('anchors a micro-timed early attack to the chord it voices', () => {
    const plan = performance([note('chord', 62, 3.98), note('chord', 60, 2)], 120, 8, TWO_CHORDS);

    expect(buildVisualNoteTimeline(plan, 4).map((event) => event.harmonyStartSec)).toEqual([0, 2]);
  });

  it('follows the declared harmony owner of an anticipation push', () => {
    const anticipation = { ...note('chord', 65, 3.5, 0.5), harmonyTargetChordIndex: 1 };
    const plan = performance([anticipation], 120, 8, TWO_CHORDS);

    expect(buildVisualNoteTimeline(plan, 4)[0]).toEqual({
      pitch: 65,
      startSec: 1.75,
      durationSec: 0.25,
      velocity: 96,
      harmonyStartSec: 2,
    });
  });

  it('keeps every harmony anchor on an export segment boundary', () => {
    const plan = generatedPerformance('A', 'natural.type1', true);
    const durationSec = plan.totalBeats * (60 / plan.bpm);
    const { segments } = buildExportPlan({
      progression: plan.progression,
      key: goldenProgressionById('A').key,
      bpm: plan.bpm,
      title: 'anchor',
      durationSec,
      audioUri: 'file://audio.wav',
      watermark: true,
      beatsPerBar: plan.beatsPerBar,
      visualStyle: 'flow',
    });
    const boundaries = segments.map((segment) => segment.startSec);
    const timeline = buildVisualNoteTimeline(plan, durationSec);

    expect(timeline.length).toBeGreaterThan(0);
    for (const visual of timeline) {
      // Segment starts accumulate per chord while an anchor is one multiplication, so
      // the two agree to float noise — well inside the renderer's 1ms boundary window.
      const drift = Math.min(
        ...boundaries.map((boundary) => Math.abs(boundary - visual.harmonyStartSec)),
      );

      expect(drift).toBeLessThan(1e-6);
    }
  });

  it.each([
    ['four-chord block', generatedPerformance('A', 'block.type1')],
    ['eight-chord progression', generatedPerformance('A', 'block.type1', true)],
    ['tension arpeggio', generatedPerformance('F', 'natural.type4')],
    ['slash chord', generatedPerformance('D', 'natural.type1')],
  ] as const)('%s remains a subset of the exact generated audio performance', (_, plan) => {
    const durationSec = plan.totalBeats * (60 / plan.bpm);
    const timeline = buildVisualNoteTimeline(plan, durationSec);
    const noteOns = buildVideoAudioRequest(plan, durationSec).midiEvents?.filter(
      (event) => event.kind === 'on' && !event.drum,
    );

    expect(timeline.length).toBeGreaterThan(0);
    for (const visual of timeline) {
      const secondsPerBeat = 60 / plan.bpm;
      expect(
        noteOns?.some(
          (event) =>
            Math.max(0, event.beat * secondsPerBeat) === visual.startSec &&
            event.a === visual.pitch &&
            event.b === visual.velocity,
        ),
      ).toBe(true);
    }
  });
});
