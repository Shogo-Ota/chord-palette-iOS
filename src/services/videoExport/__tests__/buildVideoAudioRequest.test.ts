import { goldenProgressionById } from '@/lib/midiQa/goldenProgressions';
import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
} from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { buildNativePlaybackPlan } from '@/lib/playback';
import { buildVideoAudioRequest } from '../buildVideoAudioRequest';

const STYLES = [
  { pattern: 'block', variant: 'block.type1' },
  { pattern: 'natural', variant: 'natural.type1' },
  { pattern: 'city', variant: 'city.type1' },
] as const;

function performance(
  style: (typeof STYLES)[number],
  effect: PerformanceSessionInput['instrumentEffect'] = 'sustain',
) {
  const progression = goldenProgressionById('A');
  return buildSessionPerformancePlan(
    {
      key: progression.key,
      tempoBpm: 100,
      grooveId: 'pop8',
      accompanimentPattern: style.pattern,
      accompanimentVariant: style.variant as PerformanceSessionInput['accompanimentVariant'],
      instrumentId: 'piano',
      accompanimentEnergy: 'build',
      octaveShift: 0,
      releaseCut: false,
      instrumentEffect: effect,
      drumMode: 'off',
      progression: progression.chords,
    },
    'free',
  );
}

describe('video audio Final MIDI fidelity', () => {
  it.each(STYLES)(
    '$pattern/$variant sends the exact realtime MIDI schedule to offline render',
    (style) => {
      const plan = performance(style);
      const expected = buildNativePlaybackPlan(buildFinalMidiSnapshot(plan), {
        loop: false,
      });
      const actual = buildVideoAudioRequest(plan, 9.6);

      expect(actual.midiEvents).toEqual(expected.midiEvents);
      expect(actual.gmProgram).toBe(expected.gmProgram);
      expect(actual.hasDrums).toBe(expected.hasDrums);
      expect(actual.planSignature).toBe(expected.signature);
    },
  );

  it('preserves every Natural CC64 message instead of dropping the pedal', () => {
    const plan = performance(STYLES[1]);
    const expectedCc64 = buildFinalMidiSnapshot(plan).controlChanges.filter(
      (event) => event.controller === 64,
    );
    const actualCc64 = buildVideoAudioRequest(plan, 9.6).midiEvents?.filter(
      (event) => event.kind === 'cc' && event.a === 64,
    );

    expect(expectedCc64.length).toBeGreaterThan(0);
    expect(actualCc64).toHaveLength(expectedCc64.length);
  });

  it('keeps release-cut video audio pedal-free exactly like app playback', () => {
    const plan = performance(STYLES[1], 'releaseCut');
    const actualCc64 = buildVideoAudioRequest(plan, 9.6).midiEvents?.filter(
      (event) => event.kind === 'cc' && event.a === 64,
    );

    expect(actualCc64).toEqual([]);
  });
});
