import {
  buildVerificationRequest,
  VERIFICATION_BPM,
} from '@/services/audio/fixtures';
import {
  absoluteBeat,
  beatToSample,
  buildProgression,
  clampVolume,
  eventSampleTimes,
  loopBaseSample,
  requestLoopSeconds,
  secondsPerBeat,
} from '@/services/audio/schedule';

describe('clampVolume', () => {
  it('clamps into [0, 1]', () => {
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(0)).toBe(0);
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(1)).toBe(1);
    expect(clampVolume(2)).toBe(1);
  });

  it('treats NaN as silence (0)', () => {
    expect(clampVolume(Number.NaN)).toBe(0);
  });
});

describe('tempo math', () => {
  it('secondsPerBeat at 120 BPM = 0.5s', () => {
    expect(secondsPerBeat(120)).toBeCloseTo(0.5, 10);
  });

  it('beatToSample rounds to whole samples', () => {
    // 1 beat @120bpm @48000 = 0.5s = 24000 samples
    expect(beatToSample(1, 120, 48000)).toBe(24000);
    // 2 beats = 48000 samples
    expect(beatToSample(2, 120, 48000)).toBe(48000);
  });
});

describe('buildProgression', () => {
  it('derives sequential start beats and total beats', () => {
    const { chordEvents, totalBeats } = buildProgression(
      [
        { midiNotes: [60], lengthBeats: 4 },
        { midiNotes: [62], lengthBeats: 2 },
        { midiNotes: [64], lengthBeats: 2 },
      ],
      90,
    );
    expect(chordEvents.map((e) => e.startBeat)).toEqual([0, 4, 6]);
    expect(totalBeats).toBe(8);
    expect(chordEvents.every((e) => e.velocity === 90)).toBe(true);
  });
});

describe('loop scheduling has no cumulative drift (§4.2)', () => {
  const bpm = 120;
  const sr = 48000;
  const totalBeats = 16;

  it('each loop base is an exact multiple of one loop length', () => {
    const oneLoop = loopBaseSample(1, totalBeats, bpm, sr);
    for (let n = 0; n <= 20; n++) {
      expect(loopBaseSample(n, totalBeats, bpm, sr)).toBe(n * oneLoop);
    }
  });

  it('the gap between consecutive loop bases is constant (no accumulation)', () => {
    const gaps: number[] = [];
    for (let n = 1; n <= 10; n++) {
      gaps.push(loopBaseSample(n, totalBeats, bpm, sr) - loopBaseSample(n - 1, totalBeats, bpm, sr));
    }
    expect(new Set(gaps).size).toBe(1);
  });

  it('event time = loop base + within-loop offset (absolute, not chained)', () => {
    const events = [{ startBeat: 0 }, { startBeat: 4 }, { startBeat: 8 }, { startBeat: 12 }];
    const loop0 = eventSampleTimes(events, bpm, sr, 0, totalBeats);
    const loop3 = eventSampleTimes(events, bpm, sr, 3, totalBeats);
    const base3 = loopBaseSample(3, totalBeats, bpm, sr);
    loop3.forEach((sample, i) => {
      expect(sample).toBe(base3 + loop0[i]);
    });
  });
});

describe('absoluteBeat', () => {
  it('folds loop index and within-loop beat', () => {
    expect(absoluteBeat(0, 16, 4)).toBe(4);
    expect(absoluteBeat(2, 16, 4)).toBe(36);
  });
});

describe('verification fixture', () => {
  it('is the 16-beat Cmaj7→G7→Am7→Fmaj7 request', () => {
    const req = buildVerificationRequest(true);
    expect(req.bpm).toBe(VERIFICATION_BPM);
    expect(req.totalBeats).toBe(16);
    expect(req.loop).toBe(true);
    expect(req.drumPatternId).toBe('pop8-min');
    expect(req.chordEvents).toHaveLength(4);
    expect(req.chordEvents[0].midiNotes).toEqual([60, 64, 67, 71]);
    expect(req.chordEvents.map((e) => e.startBeat)).toEqual([0, 4, 8, 12]);
  });

  it('one loop lasts 8 seconds at 120 BPM', () => {
    const req = buildVerificationRequest(true);
    expect(requestLoopSeconds(req)).toBeCloseTo(8, 10);
  });
});
