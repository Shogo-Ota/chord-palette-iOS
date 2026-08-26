/**
 * Voicing Policy v2 experiment dump.
 *
 * Run: npx jest -c scripts/quality/jest.quality.config.js --testPathPattern voicingPolicyV2.harness
 * Out:
 *   LocalAnalysis/accompaniment_quality/experiments/voicing-policy-v2/
 *   docs/performance/reports/voicing-policy-v2/
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { VOICING_POSITIONS, type VoicingPosition } from '@/lib/performance/baseVoicing';
import {
  dumpProgressionVoicings,
  dumpSelectedVoicing,
  measureCandidateGeneration,
} from '@/lib/performance/baseVoicing/voicingAnalysis';
import {
  BASELINE_PROGRESSION_IDS,
  VOICING_QUALITY_CASES,
  goldenHarmoniesById,
  harmonyFromQualityCase,
} from '@/lib/performance/baseVoicing/voicingQualityCorpus';
import {
  buildCompactBaseVoicings,
  compactCandidatesForHarmony,
} from '@/lib/performance/baseVoicing/CompactVoicingEngine';
import { selectContinuousCandidatePath } from '@/lib/performance/baseVoicing/continuity';

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

function dumpTargets(label: string) {
  const progressions = BASELINE_PROGRESSION_IDS.map((id) => goldenHarmoniesById(id));
  const quality = VOICING_QUALITY_CASES.map((item) => ({
    id: item.id,
    label: item.label,
    harmony: harmonyFromQualityCase(item),
  }));

  const rows = [];
  for (const position of VOICING_POSITIONS) {
    const preference = { position, octaveShift: 0 };
    for (const progression of progressions) {
      const chords = dumpProgressionVoicings(progression.harmonies, preference);
      rows.push({
        source: `golden-${progression.id}`,
        name: progression.name,
        position,
        octaveShift: 0,
        chords,
      });
    }
    for (const item of quality) {
      const voicing = buildCompactBaseVoicings([item.harmony], preference)[0]!;
      rows.push({
        source: `quality-${item.id}`,
        name: item.label,
        position,
        octaveShift: 0,
        chords: [dumpSelectedVoicing(voicing, 0)],
      });
    }
  }

  const highlights = {
    Fmaj7: rows
      .flatMap((row) => row.chords.filter((chord) => chord.chordSymbol === 'Fmaj7'))
      .map((chord) => ({
        position: chord.position,
        rhMidi: chord.rhMidi,
        notes: chord.notes.map((note) => note.name),
        hasRhEFAdjacency: chord.metrics.rhHasEFAdjacency,
        rhAdjacentIntervals: chord.rhAdjacentIntervals,
        bassRootDuplication: chord.metrics.bassRootDuplication,
        selectedCandidateRank: chord.selectedCandidateRank,
      })),
    'C7(♭9)': rows
      .flatMap((row) => row.chords.filter((chord) => chord.chordSymbol === 'C7(♭9)'))
      .map((chord) => ({
        position: chord.position,
        rhMidi: chord.rhMidi,
        notes: chord.notes.map((note) => note.name),
        hasRhCDbAdjacency: chord.metrics.rhHasCDbAdjacency,
        rhAdjacentIntervals: chord.rhAdjacentIntervals,
        bassRootDuplication: chord.metrics.bassRootDuplication,
        selectedCandidateRank: chord.selectedCandidateRank,
        lowestTensionPitch: chord.metrics.lowestTensionPitch,
      })),
  };

  const timing = quality.map((item) => {
    const preference = { position: 'root' as VoicingPosition, octaveShift: 0 };
    const generated = measureCandidateGeneration(item.harmony, preference);
    const started = process.hrtime.bigint();
    const layers = [compactCandidatesForHarmony(item.harmony, preference)];
    selectContinuousCandidatePath(layers);
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
  buildCompactBaseVoicings(sixteen, { position: 'root', octaveShift: 0 });
  const sixteenMs = Number(process.hrtime.bigint() - sixteenStarted) / 1e6;

  return {
    phase: label,
    capturedAt: new Date().toISOString(),
    highlights,
    timing,
    sixteenChordMs: sixteenMs,
    rows,
  };
}

describe('Voicing Policy v2 experiment dump', () => {
  it('writes the current Final MIDI snapshot without clobbering baseline', () => {
    const snapshot = dumpTargets('after');
    writeJson('after.json', snapshot);
    writeJson('current.json', snapshot);

    const baselinePath = join(DOCS_ROOT, 'baseline.json');
    if (existsSync(baselinePath)) {
      const before = JSON.parse(readFileSync(baselinePath, 'utf8')) as ReturnType<
        typeof dumpTargets
      >;
      const compare = {
        phase: 'before-after',
        capturedAt: snapshot.capturedAt,
        highlights: {
          before: before.highlights,
          after: snapshot.highlights,
        },
        timing: {
          before: before.timing,
          after: snapshot.timing,
          sixteenChordMs: { before: before.sixteenChordMs, after: snapshot.sixteenChordMs },
        },
        qualityChords: VOICING_QUALITY_CASES.flatMap((item) =>
          (['root', 'first', 'second'] as const).map((position) => {
            const prev = before.rows.find(
              (row) => row.source === `quality-${item.id}` && row.position === position,
            )?.chords[0];
            const next = snapshot.rows.find(
              (row) => row.source === `quality-${item.id}` && row.position === position,
            )?.chords[0];
            return {
              id: item.id,
              label: item.label,
              position,
              before: prev && {
                selectedMidi: [prev.bassMidi, ...prev.rhMidi],
                noteNames: prev.notes.map((note) => note.name),
                adjacentIntervals: prev.rhAdjacentIntervals,
                rhSpan: prev.rhSpan,
                staticCost: prev.staticCost,
                ...prev.metrics,
              },
              after: next && {
                selectedMidi: [next.bassMidi, ...next.rhMidi],
                noteNames: next.notes.map((note) => note.name),
                adjacentIntervals: next.rhAdjacentIntervals,
                rhSpan: next.rhSpan,
                staticCost: next.staticCost,
                ...next.metrics,
              },
            };
          }),
        ),
      };
      writeJson('before-after.json', compare);
    }

    expect(snapshot.rows.length).toBeGreaterThan(0);
    expect(snapshot.highlights.Fmaj7.length).toBeGreaterThan(0);
    expect(snapshot.highlights['C7(♭9)'].length).toBeGreaterThan(0);
  });
});
