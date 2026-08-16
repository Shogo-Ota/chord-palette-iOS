/**
 * Groove Preference Round1 blind pack.
 * Pitch comes only from fixed connectedStable voicings; Teacher JSON supplies time structure.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  GROOVE_FEATURE_SCHEMA,
  GROOVE_PROGRESSIONS,
  buildGrooveCandidates,
  grooveCandidateToSnapshot,
  teacherTakeFromRaw,
  validateControlledDifferences,
  validateGrooveCandidateSet,
  type GrooveListeningSheet,
  type RawGrooveTeacherJson,
} from '@/lib/groovePreference';
import { writeSmf } from '@/lib/midiExport/smfWrite';

const BASE_RAW =
  require('../../src/lib/performance/humanTemplate/data/P1_A3.json') as RawGrooveTeacherJson;
const VARIATION_RAW =
  require('../../src/lib/performance/humanTemplate/data/P1_C12.json') as RawGrooveTeacherJson;
const REPO = resolve(__dirname, '../..');
const OUT = join(REPO, 'LocalAnalysis/accompaniment_quality_dataset/groove_round1');

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe('Groove Preference Round1 collection pack', () => {
  it('writes 15 blind MIDI files and score-free worksheets', () => {
    const baseTake = teacherTakeFromRaw(BASE_RAW);
    const variationTake = teacherTakeFromRaw(VARIATION_RAW);
    const candidates = buildGrooveCandidates(baseTake, variationTake);
    const invariant = validateGrooveCandidateSet(candidates);
    const controlled = validateControlledDifferences(candidates);
    expect(invariant.errors).toEqual([]);
    expect(controlled.errors).toEqual([]);
    expect(candidates).toHaveLength(15);

    mkdirSync(join(OUT, 'midi'), { recursive: true });
    mkdirSync(join(OUT, 'worksheets'), { recursive: true });
    mkdirSync(join(OUT, 'analysis'), { recursive: true });
    mkdirSync(join(OUT, '_analyst'), { recursive: true });

    for (const candidate of candidates) {
      const dir = join(OUT, 'midi', candidate.progressionId);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, `${candidate.blindLabel}.mid`),
        writeSmf(grooveCandidateToSnapshot(candidate)),
      );
    }

    for (const progression of GROOVE_PROGRESSIONS) {
      const sheet: GrooveListeningSheet = {
        progressionId: progression.id,
        display: progression.display,
        bpm: 70,
        ranking: null,
        candidates: candidates
          .filter((candidate) => candidate.progressionId === progression.id)
          .slice()
          .sort((a, b) => a.blindLabel.localeCompare(b.blindLabel))
          .map((candidate) => ({
            blindLabel: candidate.blindLabel,
            listening: null,
          })),
      };
      writeJson(join(OUT, 'worksheets', `${progression.id}.json`), sheet);
    }

    writeJson(join(OUT, 'pairs.json'), {
      instruction: 'Generated from the three rankings after blind listening.',
      pairs: [],
    });
    writeJson(join(OUT, 'feature_schema.json'), GROOVE_FEATURE_SCHEMA);
    writeJson(join(OUT, '_analyst', 'KEY_DO_NOT_SHOW.json'), {
      instruction: 'Open only after all rankings and scores are saved.',
      teacherTimeline: {
        base: 'P1_A3 Natural take bars 1–4 repeated',
        phraseVariation: 'P1_A3 bars 1–4 then real P1_C12 Variation take',
        note: 'Shipped Teacher JSON contains note attacks for bars 1–4 only; no bars 5–8 note attacks were invented.',
      },
      candidates: candidates.map((candidate) => ({
        id: candidate.id,
        progressionId: candidate.progressionId,
        blindLabel: candidate.blindLabel,
        type: candidate.type,
        fixedVoicings: candidate.fixedVoicings,
        features: candidate.features,
      })),
      invariant,
      controlledDifferences: controlled,
    });
    writeJson(join(OUT, 'analysis', 'status.json'), {
      pairCount: 0,
      readyForAnalysis: false,
      note: 'Fill all three worksheets first. No Groove weights will be fitted in Round1.',
    });

    writeFileSync(
      join(OUT, 'README.md'),
      [
        '# Groove Preference Round1 — blind listening',
        '',
        'Listen only to `midi/{A-C}/{P-T}.mid` before opening `_analyst/`.',
        '',
        '- 70 BPM',
        '- Piano',
        '- Drum OFF',
        '- Release Cut OFF',
        '- 8 bars: the four-chord progression repeats twice',
        '- Pitch/voicing/register/bass/top pool is fixed within each progression',
        '',
        'For each `worksheets/{A-C}.json`:',
        '',
        '1. Set `ranking`, e.g. `\"Q > P > T > R > S\"`.',
        '2. Fill Overall / Groove / Naturalness / ForwardMotion / RhythmFeel (0–100).',
        '3. Comment is optional.',
        '',
        'Do not inspect score, feature or candidate type before saving all labels.',
        'After listening run `npm run groove:analyze`.',
        '',
      ].join('\n'),
    );
  });
});
