import { goldenProgressionById } from '@/lib/midiQa/goldenProgressions';
import { videoPerformanceInput } from '../performanceInput';

function input(voicingPosition?: 'root' | 'first' | 'second') {
  return {
    title: 'Voicing export',
    key: 'C' as const,
    bpm: 100,
    progression: goldenProgressionById('D').chords,
    grooveId: 'pop8',
    accompaniment: 'city',
    accompanimentVariant: 'city.type1',
    accompanimentEnergy: 'build',
    voicingPosition,
    instrumentId: 'piano',
    octaveShift: 0,
    releaseCut: false,
    drumMode: 'off' as const,
    drumBeat: '8' as const,
    instrumentEffect: 'sustain' as const,
  };
}

describe('video performance input', () => {
  it('passes the selected voicing into the shared playback/export pipeline', () => {
    expect(videoPerformanceInput(input('second')).voicingPosition).toBe('second');
  });

  it('normalizes omitted or invalid persisted input to root', () => {
    expect(videoPerformanceInput(input()).voicingPosition).toBe('root');
    expect(
      videoPerformanceInput({
        ...input(),
        voicingPosition: 'stale' as unknown as 'root',
      }).voicingPosition,
    ).toBe('root');
  });
});
