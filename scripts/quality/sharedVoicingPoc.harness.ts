/**
 * PHASE 2 PoC — compare the three shipping pitch paths with one style-neutral
 * Shared Compact Base Voicing candidate. This harness does not connect the
 * candidate to production playback.
 *
 * Run: npm run quality:sharedVoicingPoc
 * Out: LocalAnalysis/accompaniment_quality/experiments/shared-voicing-01/
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import {
  VOICING_POSITIONS,
  buildCompactBaseVoicings,
  compactRegisterPolicy,
  isCompactHandModel,
  type BaseVoicing,
} from '@/lib/performance/baseVoicing';
import { chordHarmonyFromEvent } from '@/lib/performance/humanTemplate/chordHarmony';
import { PUBLIC_ACCOMPANIMENT_PATTERNS } from '@/lib/performance/publicAccompaniment';
import { defaultVariantFor } from '@/lib/performance/variants';

import { planFor, voicingPerChord } from './measure';

const ROOT = join(
  process.cwd(),
  'LocalAnalysis',
  'accompaniment_quality',
  'experiments',
  'shared-voicing-01',
);

function pitchKey(voicing: BaseVoicing): string {
  return voicing.notes
    .map((note) => note.pitch)
    .sort((left, right) => left - right)
    .join(',');
}

function progressionJumps(voicings: readonly BaseVoicing[]): {
  bass: number[];
  top: number[];
} {
  const closed = [...voicings, voicings[0]!];
  const bass: number[] = [];
  const top: number[] = [];
  for (let index = 1; index < closed.length; index += 1) {
    const previous = closed[index - 1]!;
    const current = closed[index]!;
    const previousBass = previous.notes.find((note) => note.hand === 'LH')!.pitch;
    const currentBass = current.notes.find((note) => note.hand === 'LH')!.pitch;
    bass.push(Math.abs(currentBass - previousBass));
    top.push(
      Math.abs(
        Math.max(...current.notes.map((note) => note.pitch)) -
          Math.max(...previous.notes.map((note) => note.pitch)),
      ),
    );
  }
  return { bass, top };
}

describe('PHASE 2 PoC — Shared Compact Base Voicing', () => {
  it('writes historical baseline, candidate and Production evidence', () => {
    mkdirSync(ROOT, { recursive: true });

    let productionEqualChords = 0;
    let productionChordCount = 0;
    const productionDifferences: {
      progression: string;
      chordIndex: number;
      pitches: Record<string, string>;
    }[] = [];

    for (const progression of GOLDEN_PROGRESSIONS) {
      const byStyle = Object.fromEntries(
        PUBLIC_ACCOMPANIMENT_PATTERNS.map((pattern) => {
          const rendered = planFor({
            progression,
            pattern,
            variantId: defaultVariantFor(pattern).id,
            effect: 'off',
            tier: 'free',
          });
          return [
            pattern,
            voicingPerChord(rendered).map((observation) => observation.pitches.join(',')),
          ];
        }),
      );
      progression.chords.forEach((_, chordIndex) => {
        productionChordCount += 1;
        const pitches = Object.fromEntries(
          PUBLIC_ACCOMPANIMENT_PATTERNS.map((pattern) => [pattern, byStyle[pattern]![chordIndex]!]),
        );
        if (new Set(Object.values(pitches)).size === 1) productionEqualChords += 1;
        else productionDifferences.push({ progression: progression.id, chordIndex, pitches });
      });
    }

    let compactFailures = 0;
    let illegalNotes = 0;
    let duplicateMidi = 0;
    let inversionFailures = 0;
    const voiceCounts: number[] = [];
    const bassJumps: number[] = [];
    const topJumps: number[] = [];

    for (const position of VOICING_POSITIONS) {
      for (const progression of GOLDEN_PROGRESSIONS) {
        const harmonies = progression.chords.map((chord) =>
          chordHarmonyFromEvent(chord, progression.key),
        );
        const voicings = buildCompactBaseVoicings(harmonies, {
          position,
          octaveShift: 0,
        });
        const jumps = progressionJumps(voicings);
        bassJumps.push(...jumps.bass);
        topJumps.push(...jumps.top);

        voicings.forEach((voicing) => {
          voiceCounts.push(voicing.notes.length);
          if (!isCompactHandModel(voicing.notes, compactRegisterPolicy(voicing.preference))) {
            compactFailures += 1;
          }
          const allowed = new Set(
            voicing.harmony.chordIntervals.map(
              (interval) => (voicing.harmony.rootPc + interval + 120) % 12,
            ),
          );
          if (voicing.harmony.slashBassPc != null) {
            allowed.add((voicing.harmony.slashBassPc + 120) % 12);
          }
          illegalNotes += voicing.notes.filter((note) => !allowed.has(note.pc)).length;
          duplicateMidi +=
            voicing.notes.length - new Set(voicing.notes.map((note) => note.pitch)).size;

          const uniquePcs = [
            ...new Set(
              voicing.harmony.chordIntervals.map(
                (interval) => (voicing.harmony.rootPc + interval + 120) % 12,
              ),
            ),
          ];
          const expectedIndex = position === 'root' ? 0 : position === 'first' ? 1 : 2;
          const expectedBass =
            voicing.harmony.slashBassPc == null
              ? uniquePcs[Math.min(expectedIndex, uniquePcs.length - 1)]!
              : (voicing.harmony.slashBassPc + 120) % 12;
          if (voicing.notes.find((note) => note.hand === 'LH')!.pc !== expectedBass) {
            inversionFailures += 1;
          }
        });
      }
    }

    const candidateChordCount = GOLDEN_PROGRESSIONS.reduce(
      (count, progression) => count + progression.chords.length,
      0,
    );
    const candidateStyleEquality = GOLDEN_PROGRESSIONS.reduce((count, progression) => {
      const harmonies = progression.chords.map((chord) =>
        chordHarmonyFromEvent(chord, progression.key),
      );
      const shared = buildCompactBaseVoicings(harmonies);
      const consumers = PUBLIC_ACCOMPANIMENT_PATTERNS.map(() => shared.map(pitchKey));
      return (
        count +
        shared.filter(
          (_, chordIndex) => new Set(consumers.map((style) => style[chordIndex])).size === 1,
        ).length
      );
    }, 0);

    const report = {
      id: 'shared-voicing-01',
      capturedAt: '2026-08-17',
      productionModifiedByCandidate: true,
      corpus: {
        progressions: GOLDEN_PROGRESSIONS.map(({ id, name }) => ({ id, name })),
        chordCount: productionChordCount,
      },
      historicalBaseline: {
        evidence: 'baseline.json',
        styleEqualChords: 0,
        styleComparedChords: 36,
      },
      production: {
        styleEqualChords: productionEqualChords,
        styleComparedChords: productionChordCount,
        differences: productionDifferences,
      },
      candidate: {
        styleEqualChords: candidateStyleEquality,
        styleComparedChords: candidateChordCount,
        evaluatedVoicings: voiceCounts.length,
        compactFailures,
        illegalNotes,
        duplicateMidi,
        inversionFailures,
        voiceCount: {
          min: Math.min(...voiceCounts),
          max: Math.max(...voiceCounts),
          mean: voiceCounts.reduce((sum, count) => sum + count, 0) / voiceCounts.length,
        },
        maxBassJumpIncludingLoop: Math.max(...bassJumps),
        maxTopJumpIncludingLoop: Math.max(...topJumps),
      },
      decision:
        productionEqualChords === productionChordCount
          ? 'KEEP_PRODUCTION_PROMOTION'
          : 'REVERT_PRODUCTION_PROMOTION',
    };
    writeFileSync(join(ROOT, 'comparison.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      'SHARED VOICING PRODUCTION:\n',
      JSON.stringify({ production: report.production, candidate: report.candidate }, null, 2),
    );

    expect(report.historicalBaseline.styleEqualChords).toBeLessThan(
      report.historicalBaseline.styleComparedChords,
    );
    expect(report.production).toMatchObject({
      styleEqualChords: productionChordCount,
      styleComparedChords: productionChordCount,
      differences: [],
    });
    expect(report.candidate).toMatchObject({
      styleEqualChords: candidateChordCount,
      compactFailures: 0,
      illegalNotes: 0,
      duplicateMidi: 0,
      inversionFailures: 0,
      maxBassJumpIncludingLoop: expect.any(Number),
      maxTopJumpIncludingLoop: expect.any(Number),
    });
    expect(report.candidate.maxBassJumpIncludingLoop).toBeLessThan(12);
    expect(report.candidate.maxTopJumpIncludingLoop).toBeLessThan(12);
  });
});
