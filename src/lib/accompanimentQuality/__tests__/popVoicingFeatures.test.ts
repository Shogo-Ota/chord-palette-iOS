import { identifyQuality, inversionOf, degreeLabel, wrapPc } from '../pop909Chords';
import {
  featuresFromVoicingPair,
  groupAttacks,
  rolesForPitches,
  voiceLeadingFeatures,
} from '../popVoicingFeatures';

const C = { rootPc: 0, quality: 'major' as const, bassPc: 0, symbol: 'C' };
const Am = { rootPc: 9, quality: 'minor' as const, bassPc: 9, symbol: 'Am' };

describe('chord quality / inversion / degree', () => {
  it('identifies C major and Cmaj7', () => {
    expect(identifyQuality([0, 4, 7])).toEqual({ rootPc: 0, quality: 'major' });
    expect(identifyQuality([0, 4, 7, 11])).toEqual({ rootPc: 0, quality: 'maj7' });
    expect(identifyQuality([0, 4, 7, 2])).toEqual({ rootPc: 0, quality: 'add9' });
  });

  it('detects inversions from bass degree', () => {
    expect(inversionOf(degreeLabel(48, 0))).toBe('root');
    expect(inversionOf(degreeLabel(52, 0))).toBe('first');
    expect(inversionOf(degreeLabel(55, 0))).toBe('second');
  });

  it('assigns BASS / INNER / UPPER / TOP by pitch order', () => {
    expect(rolesForPitches([48, 52, 55, 64])).toEqual(['BASS', 'INNER', 'UPPER', 'TOP']);
  });
});

describe('transposition invariance', () => {
  it('same voicing in another key yields equivalent relative features', () => {
    const inC = featuresFromVoicingPair([48, 52, 55, 60], [48, 52, 57, 60], C, Am);
    const D = { rootPc: 2, quality: 'major' as const, bassPc: 2, symbol: 'D' };
    const Bm = { rootPc: 11, quality: 'minor' as const, bassPc: 11, symbol: 'Bm' };
    const inD = featuresFromVoicingPair([50, 54, 57, 62], [50, 54, 59, 62], D, Bm);
    expect(inD.voiceLeading.meanVoiceMovement).toBeCloseTo(inC.voiceLeading.meanVoiceMovement);
    expect(inD.voiceLeading.commonToneRate).toBeCloseTo(inC.voiceLeading.commonToneRate);
    expect(inD.bass.bassDegree).toBe(inC.bass.bassDegree);
    expect(inD.top.topDegree).toBe(inC.top.topDegree);
    expect(inD.bass.inversion).toBe(inC.bass.inversion);
    expect(inD.register.spanDelta).not.toBeNull();
    expect(inC.register.spanDelta).not.toBeNull();
    expect(inD.register.spanDelta ?? 0).toBeCloseTo(inC.register.spanDelta ?? 0);
    expect(inD.rootMotionSemitones).not.toBeNull();
    expect(inC.rootMotionSemitones).not.toBeNull();
    expect(wrapPc(inD.rootMotionSemitones ?? 0)).toBe(wrapPc(inC.rootMotionSemitones ?? 0));
  });
});

describe('attack grouping and voice leading', () => {
  it('clusters near-simultaneous onsets', () => {
    const groups = groupAttacks([
      { startBeat: 0, pitch: 48 },
      { startBeat: 0.02, pitch: 55 },
      { startBeat: 1, pitch: 60 },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].pitches).toEqual([48, 55]);
  });

  it('records common-tone rate and movement', () => {
    const vl = voiceLeadingFeatures([48, 52, 55], [48, 52, 57]);
    expect(vl.commonToneCount).toBe(2);
    expect(vl.maxVoiceMovement).toBe(2);
    expect(vl.voiceCrossing).toBe(0);
  });

  it('marks a 9th as a color extension, not bass, on Cadd9', () => {
    const Cadd9 = { rootPc: 0, quality: 'add9' as const, bassPc: 0, symbol: 'Cadd9' };
    const feat = featuresFromVoicingPair([48, 52, 55], [48, 52, 55, 62], C, Cadd9);
    expect(feat.extensions.some((e) => e.degree === '9' && e.role !== 'BASS')).toBe(true);
  });
});
