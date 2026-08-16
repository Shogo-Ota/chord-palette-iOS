import { mapPerfNotesToPlaybackRequest } from '@/services/audio/performanceMapper';

describe('mapPerfNotesToPlaybackRequest drumMode', () => {
  it('forwards drumMode to native playback request', () => {
    const req = mapPerfNotesToPlaybackRequest([], {
      bpm: 120,
      totalBeats: 16,
      loop: true,
      drumPatternId: 'pop8',
      instrument: 'piano',
      drumMode: 'clap',
    });
    expect(req.drumMode).toBe('clap');
  });
});
