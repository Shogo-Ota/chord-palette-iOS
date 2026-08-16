import {
  analyzeGroovePairs,
  buildGrooveCandidates,
  grooveLabelToIdMap,
  groovePairsFromRanking,
  teacherTakeFromRaw,
  validateControlledDifferences,
  validateGrooveCandidateSet,
  type GrooveCandidate,
  type RawGrooveTeacherJson,
} from '..';

const raw = require('../../performance/humanTemplate/data/P1_A3.json') as RawGrooveTeacherJson;
const variationRaw =
  require('../../performance/humanTemplate/data/P1_C12.json') as RawGrooveTeacherJson;
const take = teacherTakeFromRaw(raw);
const variationTake = teacherTakeFromRaw(variationRaw);

function candidate(
  candidates: readonly GrooveCandidate[],
  progressionId: 'A' | 'B' | 'C',
  type: GrooveCandidate['type'],
): GrooveCandidate {
  const found = candidates.find(
    (item) => item.progressionId === progressionId && item.type === type,
  );
  if (!found) throw new Error(`missing ${progressionId}-${type}`);
  return found;
}

describe('Groove Preference Round1 candidate isolation', () => {
  it('builds 3 progressions × 5 strategies and expands the four-bar source to eight bars', () => {
    expect(take.totalMusicalBars).toBe(8);
    expect(new Set(take.attacks.map((attack) => attack.musicalBar))).toEqual(new Set([1, 2, 3, 4]));
    const candidates = buildGrooveCandidates(take, variationTake);
    expect(candidates).toHaveLength(15);
    expect(validateGrooveCandidateSet(candidates)).toEqual({ ok: true, errors: [] });
    expect(validateControlledDifferences(candidates)).toEqual({ ok: true, errors: [] });
  });

  it('uses deterministic, unique blind labels per progression', () => {
    const first = buildGrooveCandidates(take, variationTake);
    const second = buildGrooveCandidates(take, variationTake);
    for (const progressionId of ['A', 'B', 'C'] as const) {
      const a = grooveLabelToIdMap(first, progressionId);
      const b = grooveLabelToIdMap(second, progressionId);
      expect(a).toEqual(b);
      expect(Object.keys(a).sort()).toEqual(['P', 'Q', 'R', 'S', 'T']);
      expect(Object.keys(a).join('')).not.toMatch(/teacher|broken|phrase/i);
    }
  });

  it('quantizes timing without changing the fixed voicing pool', () => {
    const candidates = buildGrooveCandidates(take, variationTake);
    const baseline = candidate(candidates, 'A', 'TEACHER_TIMELINE_REPEAT');
    const quantized = candidate(candidates, 'A', 'QUANTIZED_CONTROL');
    expect(quantized.fixedVoicings).toEqual(baseline.fixedVoicings);
    expect(quantized.features.gridDeviationMean).toBeLessThanOrEqual(
      baseline.features.gridDeviationMean,
    );
  });

  it('reduces density without extending surviving durations', () => {
    const candidates = buildGrooveCandidates(take, variationTake);
    const baseline = candidate(candidates, 'A', 'TEACHER_TIMELINE_REPEAT');
    const simplified = candidate(candidates, 'A', 'SIMPLIFIED_DENSITY');
    expect(simplified.features.attackDensity).toBeLessThan(baseline.features.attackDensity);
    expect(validateControlledDifferences(candidates).ok).toBe(true);
  });

  it('breaks timing–velocity relation mildly while preserving velocity distribution', () => {
    const candidates = buildGrooveCandidates(take, variationTake);
    const baseline = candidate(candidates, 'A', 'TEACHER_TIMELINE_REPEAT');
    const broken = candidate(candidates, 'A', 'BROKEN_CONTROL');
    expect(broken.features.velocityMean).toBeCloseTo(baseline.features.velocityMean, 10);
    expect(broken.features.velocityStd).toBeCloseTo(baseline.features.velocityStd, 10);
    expect(broken.features.velocityRange).toBe(baseline.features.velocityRange);
    expect(broken.features.attackDensity).toBe(baseline.features.attackDensity);
    expect(broken.features.timingVelocityCorrelation).not.toBeCloseTo(
      baseline.features.timingVelocityCorrelation,
      4,
    );
  });

  it('uses the real Variation take for phrase two without changing fixed voicings', () => {
    const candidates = buildGrooveCandidates(take, variationTake);
    const baseline = candidate(candidates, 'A', 'TEACHER_TIMELINE_REPEAT');
    const phrase = candidate(candidates, 'A', 'PHRASE_VARIATION');
    expect(baseline.features.phraseRepetitionSimilarity).toBeCloseTo(1, 10);
    expect(phrase.features.phraseVariationAmount).toBeGreaterThan(
      baseline.features.phraseVariationAmount,
    );
    expect(phrase.fixedVoicings).toEqual(baseline.fixedVoicings);
  });
});

describe('Groove preference pairs and analysis', () => {
  it('expands one five-candidate ranking into ten pairs', () => {
    const candidates = buildGrooveCandidates(take, variationTake);
    const labels = grooveLabelToIdMap(candidates, 'A');
    const pairs = groovePairsFromRanking('A', 'P > Q > R > S > T', labels);
    expect(pairs).toHaveLength(10);
  });

  it('starts analysis at 30 pairs but reports only three independent progressions', () => {
    const candidates = buildGrooveCandidates(take, variationTake);
    const pairs = (['A', 'B', 'C'] as const).flatMap((progressionId) =>
      groovePairsFromRanking(
        progressionId,
        'P > Q > R > S > T',
        grooveLabelToIdMap(candidates, progressionId),
      ),
    );
    const report = analyzeGroovePairs(pairs, candidates);
    expect(report.pairCount).toBe(30);
    expect(report.readyForAnalysis).toBe(true);
    expect(report.independentProgressionCount).toBe(3);
  });
});
