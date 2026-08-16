import { pocCandidatesCAmFG } from '../candidateFactory';
import { featuresFromVoicingPair } from '../popVoicingFeatures';
import { ANALYZER_VERSION, buildPopPrior, summarize, validatePopPrior } from '../popPrior';
import { densityScore, scoreTransition } from '../popVoicingScore';

const C = { rootPc: 0, quality: 'major' as const, bassPc: 0, symbol: 'C' };
const Am = { rootPc: 9, quality: 'minor' as const, bassPc: 9, symbol: 'Am' };
const F = { rootPc: 5, quality: 'major' as const, bassPc: 5, symbol: 'F' };
const G = { rootPc: 7, quality: 'major' as const, bassPc: 7, symbol: 'G' };

function rows() {
  const smooth = [
    featuresFromVoicingPair([48, 52, 55, 60], [48, 52, 57, 60], C, Am),
    featuresFromVoicingPair([48, 52, 57, 60], [48, 53, 57, 60], Am, F),
    featuresFromVoicingPair([48, 53, 57, 60], [47, 50, 55, 59], F, G),
  ];
  const copies: typeof smooth = [];
  for (let i = 0; i < 40; i += 1) copies.push(...smooth);
  return copies;
}

describe('distribution builder', () => {
  it('is deterministic and has ordered percentiles', () => {
    const a = summarize([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const b = summarize([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(a).toEqual(b);
    expect(a.p10).toBeLessThanOrEqual(a.median);
    expect(a.median).toBeLessThanOrEqual(a.p90);
  });

  it('builds a valid prior from repeated pop-like transitions', () => {
    const prior = buildPopPrior(rows(), {
      dataset: 'synthetic-poc',
      date: '2026-08-15',
      gitCommit: null,
      songCount: 1,
      includedSampleCount: rows().length,
      excludedSampleCount: 0,
      exclusionReasons: {},
      pocSongLimit: 1,
    });
    expect(prior.metadata.analyzerVersion).toBe(ANALYZER_VERSION);
    expect(validatePopPrior(prior)).toEqual([]);
    const again = buildPopPrior(rows(), { ...prior.metadata, dataset: prior.dataset });
    expect(again.voiceLeading.meanVoiceMovement).toEqual(prior.voiceLeading.meanVoiceMovement);
  });
});

describe('PopVoicingScore v0', () => {
  it('is deterministic and penalizes extreme outliers', () => {
    const prior = buildPopPrior(rows(), {
      dataset: 'synthetic-poc',
      date: '2026-08-15',
      gitCommit: null,
      songCount: 1,
      includedSampleCount: rows().length,
      excludedSampleCount: 0,
      exclusionReasons: {},
      pocSongLimit: 1,
    });
    const inlier = densityScore(prior.voiceLeading.meanVoiceMovement.median, prior.voiceLeading.meanVoiceMovement);
    const outlier = densityScore(
      prior.voiceLeading.meanVoiceMovement.p90 + 20,
      prior.voiceLeading.meanVoiceMovement,
    );
    expect(inlier).toBeGreaterThan(outlier);
    const feat = featuresFromVoicingPair([48, 52, 55, 60], [48, 52, 57, 60], C, Am);
    expect(scoreTransition(feat, prior)).toEqual(scoreTransition(feat, prior));
  });

  it('separates constructed High / Mid / Low C|Am|F|G groups', () => {
    const prior = buildPopPrior(rows(), {
      dataset: 'synthetic-poc',
      date: '2026-08-15',
      gitCommit: null,
      songCount: 1,
      includedSampleCount: rows().length,
      excludedSampleCount: 0,
      exclusionReasons: {},
      pocSongLimit: 1,
    });
    const [high, mid, low] = pocCandidatesCAmFG(prior);
    expect(high.meanScore).toBeGreaterThan(low.meanScore);
    expect(mid.meanScore).toBeGreaterThan(low.meanScore);
  });
});
