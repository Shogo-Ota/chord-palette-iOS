import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { playbackTestSessionInput } from '@/lib/playback/fixtures';
import { mapPerfNotesToPlaybackRequest } from '@/services/audio/performanceMapper';
import {
  activePlaybackEngine,
  resolveBuildPlaybackEngine,
  setPlaybackEngineOverride,
  withNativePlaybackPlan,
} from '@/services/audio/playbackEngine';

describe('playback engine policy', () => {
  afterEach(() => {
    setPlaybackEngineOverride(null);
  });

  it('defaults to the Final MIDI-faithful sequencer', () => {
    expect(resolveBuildPlaybackEngine(undefined)).toBe('sequencer');
    expect(resolveBuildPlaybackEngine('')).toBe('sequencer');
    expect(resolveBuildPlaybackEngine('unknown')).toBe('sequencer');
    expect(activePlaybackEngine()).toBe('sequencer');
  });

  it('keeps both engines as explicit reversible diagnostic choices', () => {
    expect(resolveBuildPlaybackEngine('sampled')).toBe('sampled');
    expect(resolveBuildPlaybackEngine('sequencer')).toBe('sequencer');
  });

  it('allows a temporary runtime A/B override', () => {
    setPlaybackEngineOverride('sampled');
    expect(activePlaybackEngine()).toBe('sampled');

    setPlaybackEngineOverride('sequencer');
    expect(activePlaybackEngine()).toBe('sequencer');
  });

  it('attaches the complete native MIDI schedule on the default path', () => {
    const plan = buildSessionPerformancePlan(playbackTestSessionInput('natural'), 'free');
    const request = mapPerfNotesToPlaybackRequest(plan.notes, {
      bpm: plan.bpm,
      totalBeats: plan.totalBeats,
      loop: true,
      drumPatternId: plan.drumPatternId,
      instrument: plan.instrumentId,
      beatsPerBar: plan.beatsPerBar,
      drumMode: plan.drumMode,
    });
    const snapshot = buildFinalMidiSnapshot(plan);
    const actual = withNativePlaybackPlan(request, plan);

    expect(actual.engine).toBe('sequencer');
    expect(actual.midiEvents).toHaveLength(
      snapshot.notes.length * 2 +
        snapshot.controlChanges.filter((event) => event.controller === 64).length,
    );
    expect(actual.planSignature).toMatch(/^[0-9a-f]{8}$/);
  });
});
