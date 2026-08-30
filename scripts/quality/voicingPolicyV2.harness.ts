/**
 * Voicing Policy comparison dump.
 *
 * Renders the same corpus through the approved policy and the candidate so the
 * difference can be read note by note before anyone listens. It only observes:
 * it never selects a policy for production.
 *
 * Run: npx jest -c scripts/quality/jest.quality.config.js --testPathPattern voicingPolicyV2.harness
 * Out:
 *   LocalAnalysis/accompaniment_quality/experiments/voicing-policy-v2/
 *   docs/performance/reports/voicing-policy-v2/
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import {
  COMPACT_V1_POLICY,
  COMPACT_V2_POLICY,
  VOICING_POSITIONS,
  buildCompactBaseVoicings,
  compactCandidatesForHarmony,
  selectVoicingPath,
  type VoicingPolicySpec,
  type VoicingPosition,
} from '@/lib/performance/baseVoicing';
import {
  dumpProgressionVoicings,
  dumpSelectedVoicing,
  measureCandidateGeneration,
  type SelectedVoicingDump,
} from '@/lib/performance/baseVoicing/voicingAnalysis';
import {
  BASELINE_PROGRESSION_IDS,
  VOICING_QUALITY_CASES,
  goldenHarmoniesById,
  harmonyFromQualityCase,
} from '@/lib/performance/baseVoicing/voicingQualityCorpus';

const LOCAL_ROOT = join(
  process.cwd(),
  'LocalAnalysis',
  'accompaniment_quality',
  'experiments',
  'voicing-policy-v2',
);
const DOCS_ROOT = join(process.cwd(), 'docs', 'performance', 'reports', 'voicing-policy-v2');

function writeJson(filename: string, value: unknown): void {
  for (const root of [LOCAL_ROOT, DOCS_ROOT]) {
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, filename), `${JSON.stringify(value, null, 2)}\n`);
  }
}

type PolicyDumpRow = {
  source: string;
  name: string;
  position: VoicingPosition;
  octaveShift: number;
  chords: SelectedVoicingDump[];
};

function dumpTargets(policy: VoicingPolicySpec) {
  const progressions = BASELINE_PROGRESSION_IDS.map((id) => goldenHarmoniesById(id));
  const quality = VOICING_QUALITY_CASES.map((item) => ({
    id: item.id,
    label: item.label,
    harmony: harmonyFromQualityCase(item),
  }));

  const rows: PolicyDumpRow[] = [];
  for (const position of VOICING_POSITIONS) {
    const preference = { position, octaveShift: 0 };
    for (const progression of progressions) {
      rows.push({
        source: `golden-${progression.id}`,
        name: progression.name,
        position,
        octaveShift: 0,
        chords: dumpProgressionVoicings(progression.harmonies, preference, policy),
      });
    }
    for (const item of quality) {
      const voicing = buildCompactBaseVoicings([item.harmony], preference, policy)[0]!;
      rows.push({
        source: `quality-${item.id}`,
        name: item.label,
        position,
        octaveShift: 0,
        chords: [dumpSelectedVoicing(voicing, 0, policy)],
      });
    }
  }

  const highlight = (symbol: string) =>
    rows
      .flatMap((row) => row.chords.filter((chord) => chord.chordSymbol === symbol))
      .map((chord) => ({
        position: chord.position,
        rhMidi: chord.rhMidi,
        notes: chord.notes.map((note) => note.name),
        rhAdjacentIntervals: chord.rhAdjacentIntervals,
        hasRhEFAdjacency: chord.metrics.rhHasEFAdjacency,
        hasRhCDbAdjacency: chord.metrics.rhHasCDbAdjacency,
        bassRootDuplication: chord.metrics.bassRootDuplication,
        lowestTensionPitch: chord.metrics.lowestTensionPitch,
        selectedCandidateRank: chord.selectedCandidateRank,
      }));

  const timing = quality.map((item) => {
    const preference = { position: 'root' as VoicingPosition, octaveShift: 0 };
    const generated = measureCandidateGeneration(item.harmony, preference, policy);
    const started = process.hrtime.bigint();
    selectVoicingPath([compactCandidatesForHarmony(item.harmony, preference, policy)], policy);
    const dpMs = Number(process.hrtime.bigint() - started) / 1e6;
    return {
      id: item.id,
      label: item.label,
      candidates: generated.candidateCount,
      generationMs: generated.generationMs,
      dpMs,
    };
  });

  const sixteen = Array.from(
    { length: 16 },
    (_, index) => quality[index % quality.length]!.harmony,
  );
  const sixteenStarted = process.hrtime.bigint();
  buildCompactBaseVoicings(sixteen, { position: 'root', octaveShift: 0 }, policy);
  const sixteenMs = Number(process.hrtime.bigint() - sixteenStarted) / 1e6;

  return {
    policy: policy.id,
    listeningApproved: policy.listeningApproved,
    capturedAt: new Date().toISOString(),
    highlights: { Fmaj7: highlight('Fmaj7'), 'C7(♭9)': highlight('C7(♭9)') },
    timing,
    sixteenChordMs: sixteenMs,
    rows,
  };
}

describe('Voicing Policy comparison dump', () => {
  it('writes the approved and candidate snapshots side by side', () => {
    const approved = dumpTargets(COMPACT_V1_POLICY);
    const candidate = dumpTargets(COMPACT_V2_POLICY);
    writeJson('approved-v1.json', approved);
    writeJson('candidate-v2.json', candidate);

    writeJson('before-after.json', {
      phase: 'approved-vs-candidate',
      capturedAt: candidate.capturedAt,
      shipped: approved.policy,
      candidate: candidate.policy,
      highlights: { before: approved.highlights, after: candidate.highlights },
      timing: {
        before: approved.timing,
        after: candidate.timing,
        sixteenChordMs: { before: approved.sixteenChordMs, after: candidate.sixteenChordMs },
      },
      qualityChords: VOICING_QUALITY_CASES.flatMap((item) =>
        VOICING_POSITIONS.map((position) => {
          const pick = (snapshot: typeof approved) =>
            snapshot.rows.find(
              (row) => row.source === `quality-${item.id}` && row.position === position,
            )?.chords[0];
          const summarize = (chord: ReturnType<typeof pick>) =>
            chord && {
              selectedMidi: [chord.bassMidi, ...chord.rhMidi],
              noteNames: chord.notes.map((note) => note.name),
              adjacentIntervals: chord.rhAdjacentIntervals,
              rhSpan: chord.rhSpan,
              staticCost: chord.staticCost,
              ...chord.metrics,
            };
          return {
            id: item.id,
            label: item.label,
            position,
            before: summarize(pick(approved)),
            after: summarize(pick(candidate)),
          };
        }),
      ),
    });

    expect(approved.rows.length).toBe(candidate.rows.length);
    expect(candidate.highlights.Fmaj7.length).toBeGreaterThan(0);
    expect(candidate.highlights['C7(♭9)'].length).toBeGreaterThan(0);
  });
});
