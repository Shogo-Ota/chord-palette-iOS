/**
 * POP909 Prior PoC — inspect, extract ≤200 songs, build prior, score High/Mid/Low.
 * Does not change the production realizer. Raw MIDI stays under LocalDatasets/.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import {
  buildPopPrior,
  extractTransitionsFromSong,
  findChordTrack,
  findPianoTrack,
  parseSmfDetailed,
  pocCandidatesCAmFG,
  candidateToMidiBytes,
  validatePopPrior,
  type TransitionFeatures,
} from '@/lib/accompanimentQuality';

import { originalMidiPath, listClMidiFiles, songIdFromName } from './datasetPaths';
import { inspectCorpus, renderInspectionMarkdown } from './inspectDataset';

const REPO = resolve(__dirname, '../..');
const ANALYSIS = join(REPO, 'LocalAnalysis/pop909');
const ASSET = join(REPO, 'assets/quality/pop909_prior_v1.json');
const LIMIT = Number.parseInt(process.env.POP909_POC_LIMIT ?? '200', 10);
const SKIP_IDS = new Set(['518', '620']);

function gitCommit(): string | null {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: REPO, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe('POP909 quality prior PoC', () => {
  it('inspects the local datasets, builds a prior, and writes blind candidates', () => {
    mkdirSync(join(ANALYSIS, 'summaries'), { recursive: true });
    mkdirSync(join(ANALYSIS, 'extracted_features'), { recursive: true });
    mkdirSync(join(ANALYSIS, 'validation'), { recursive: true });
    mkdirSync(join(ANALYSIS, 'poc_candidates'), { recursive: true });
    mkdirSync(join(REPO, 'assets/quality'), { recursive: true });
    mkdirSync(join(REPO, 'LocalAnalysis/accompaniment_quality_dataset/samples'), { recursive: true });

    const inspection = inspectCorpus(8);
    writeFileSync(join(ANALYSIS, 'dataset_inspection.md'), renderInspectionMarkdown(inspection));
    expect(inspection.clMidiCount).toBe(909);
    expect(inspection.origSongCount).toBe(909);
    expect(inspection.origHasPianoName).toBeGreaterThan(800);

    const clFiles = listClMidiFiles();
    const transitions: TransitionFeatures[] = [];
    const exclusionReasons: Record<string, number> = {};
    let includedSongs = 0;
    let excludedSongs = 0;
    const usedIds: string[] = [];

    for (const clPath of clFiles) {
      if (includedSongs >= LIMIT) break;
      const id = songIdFromName(basename(clPath));
      if (SKIP_IDS.has(id)) {
        exclusionReasons.cl_known_issue = (exclusionReasons.cl_known_issue ?? 0) + 1;
        excludedSongs += 1;
        continue;
      }
      const origPath = originalMidiPath(id);
      if (!existsSync(origPath)) {
        exclusionReasons.missing_original = (exclusionReasons.missing_original ?? 0) + 1;
        excludedSongs += 1;
        continue;
      }
      try {
        const pianoSong = parseSmfDetailed(readFileSync(origPath));
        const chordSong = parseSmfDetailed(readFileSync(clPath));
        const pianoTrack = findPianoTrack(pianoSong);
        const chordTrack = findChordTrack(chordSong);
        if (pianoTrack < 0) {
          exclusionReasons.no_piano_track_name = (exclusionReasons.no_piano_track_name ?? 0) + 1;
          excludedSongs += 1;
          continue;
        }
        if (chordTrack < 0) {
          exclusionReasons.no_chord_track = (exclusionReasons.no_chord_track ?? 0) + 1;
          excludedSongs += 1;
          continue;
        }
        const extracted = extractTransitionsFromSong({
          piano: pianoSong,
          pianoTrack,
          chords: chordSong,
          chordTrack,
        });
        if (extracted.excludedReason || extracted.transitions.length === 0) {
          const reason = extracted.excludedReason ?? 'no_transitions';
          exclusionReasons[reason] = (exclusionReasons[reason] ?? 0) + 1;
          excludedSongs += 1;
          continue;
        }
        transitions.push(...extracted.transitions);
        usedIds.push(id);
        includedSongs += 1;
      } catch (err) {
        exclusionReasons.parse_error = (exclusionReasons.parse_error ?? 0) + 1;
        excludedSongs += 1;
        void err;
      }
    }

    expect(includedSongs).toBeGreaterThan(50);
    expect(transitions.length).toBeGreaterThan(200);

    const prior = buildPopPrior(transitions, {
      dataset: 'POP909-CL + POP909 PIANO track',
      date: '2026-08-15',
      gitCommit: gitCommit(),
      songCount: includedSongs,
      includedSampleCount: transitions.length,
      excludedSampleCount: excludedSongs,
      exclusionReasons,
      pocSongLimit: LIMIT,
    });
    const priorErrors = validatePopPrior(prior);
    writeJson(ASSET, prior);
    writeJson(join(ANALYSIS, 'summaries/pop909_prior_v1.json'), prior);
    writeJson(join(ANALYSIS, 'extracted_features/poc_song_ids.json'), usedIds);
    writeJson(join(ANALYSIS, 'validation/prior_validation.json'), {
      errors: priorErrors,
      includedSongs,
      transitions: transitions.length,
      exclusionReasons,
    });
    expect(priorErrors).toEqual([]);

    const candidates = pocCandidatesCAmFG(prior);
    const [high, mid, low] = candidates;
    expect(high.meanScore).toBeGreaterThan(low.meanScore);

    const blindDir = join(ANALYSIS, 'poc_candidates');
    const key = candidates.map((c) => ({
      blindLabel: c.blindLabel,
      id: c.id,
      group: c.group,
      meanScore: c.meanScore,
      components: c.scores,
    }));
    writeJson(join(blindDir, 'KEY_DO_NOT_SHOW.json'), key);

    for (const c of candidates) {
      const file = `${c.blindLabel.replace(/\s+/g, '_')}.mid`;
      writeFileSync(join(blindDir, file), candidateToMidiBytes(c));
      writeJson(join(blindDir, `${c.blindLabel.replace(/\s+/g, '_')}.features.json`), {
        candidateId: c.id,
        blindLabel: c.blindLabel,
        progression: c.progression,
        voicings: c.voicings,
        meanScore: c.meanScore,
        scores: c.scores,
        transitions: c.transitions,
      });
    }

    const samples = candidates.map((c) => ({
      candidateId: c.id,
      input: { progression: c.progression, pattern: 'offline-poc', bpm: 70 },
      features: c.transitions,
      pop909Score: Math.round(c.meanScore),
      listening: null,
    }));
    writeJson(join(REPO, 'LocalAnalysis/accompaniment_quality_dataset/samples/poc_camfg.json'), samples);
    writeJson(join(REPO, 'LocalAnalysis/accompaniment_quality_dataset/listening_scores.json'), {
      instruction: 'Fill after blind listening. Do not look at KEY_DO_NOT_SHOW.json first.',
      samples: samples.map((s) => ({ candidateId: s.candidateId, listening: null })),
    });
    writeJson(join(REPO, 'LocalAnalysis/accompaniment_quality_dataset/preferences.json'), {
      instruction: 'Record X > Z > Y style rankings after listening with scores hidden.',
      pairs: [] as Array<{ preferred: string; rejected: string; reason: string[] }>,
    });

    writeFileSync(
      join(ANALYSIS, 'summaries/poc_summary.md'),
      [
        '# POP909 PoC summary',
        '',
        `- Songs included: ${includedSongs}`,
        `- Transitions: ${transitions.length}`,
        `- Songs excluded: ${excludedSongs}`,
        `- Prior: assets/quality/pop909_prior_v1.json`,
        `- High/Mid/Low mean scores: ${high.meanScore.toFixed(1)} / ${mid.meanScore.toFixed(1)} / ${low.meanScore.toFixed(1)}`,
        '',
        '## Blind listening',
        '',
        'Play only `Candidate_X.mid` / `Candidate_Y.mid` / `Candidate_Z.mid`.',
        'Do not open `KEY_DO_NOT_SHOW.json` until rankings are written.',
        '',
      ].join('\n'),
    );
  });
});
