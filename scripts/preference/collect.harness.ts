/**
 * Write blind MIDI + empty worksheets for Preference Score data collection.
 * Does not change the production realizer. Features/scores stay in _analyst only.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  buildPreferenceCandidates,
  gateOfflineSnapshot,
  voicingsToMidiBytes,
  voicingsToSnapshot,
  type Pop909PriorV1,
} from '@/lib/accompanimentQuality';
import { scoreTransition } from '@/lib/accompanimentQuality/popVoicingScore';
import type { ProgressionListeningSheet } from '@/lib/accompanimentQuality/listeningTypes';
import { PREFERENCE_PROGRESSIONS } from '@/lib/accompanimentQuality/preferenceCandidates';

const REPO = resolve(__dirname, '../..');
const PRIOR = join(REPO, 'assets/quality/pop909_prior_v1.json');
const OUT = join(REPO, 'LocalAnalysis/accompaniment_quality_dataset/round1');

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe('preference data collection pack', () => {
  it('writes 25 blind MIDI files and empty worksheets without scores', () => {
    const prior = JSON.parse(readFileSync(PRIOR, 'utf8')) as Pop909PriorV1;
    const candidates = buildPreferenceCandidates(prior);
    expect(candidates).toHaveLength(25);
    expect(candidates.every((c) => c.hardGateOk)).toBe(true);

    mkdirSync(join(OUT, 'midi'), { recursive: true });
    mkdirSync(join(OUT, 'worksheets'), { recursive: true });
    mkdirSync(join(OUT, '_analyst'), { recursive: true });

    for (const c of candidates) {
      const snap = voicingsToSnapshot(c.voicings, c.progression, 70);
      expect(gateOfflineSnapshot(snap).ok).toBe(true);
      const dir = join(OUT, 'midi', c.progressionId);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${c.blindLabel}.mid`), voicingsToMidiBytes(c.voicings, c.progression, 70));
    }

    for (const prog of PREFERENCE_PROGRESSIONS) {
      const group = candidates.filter((c) => c.progressionId === prog.id);
      const sheet: ProgressionListeningSheet = {
        progressionId: prog.id,
        display: prog.display,
        bpm: 70,
        ranking: null,
        candidates: group
          .slice()
          .sort((a, b) => a.blindLabel.localeCompare(b.blindLabel))
          .map((c) => ({
            blindLabel: c.blindLabel,
            listening: null,
          })),
      };
      writeJson(join(OUT, 'worksheets', `${prog.id}.json`), sheet);
    }

    writeJson(
      join(OUT, '_analyst', 'KEY_DO_NOT_SHOW.json'),
      candidates.map((c) => ({
        id: c.id,
        progressionId: c.progressionId,
        style: c.style,
        blindLabel: c.blindLabel,
        outlier: c.outlier.level,
        pop909Mean: Number(
          (
            c.transitions.reduce((s, t) => s + scoreTransition(t, prior).score, 0) / c.transitions.length
          ).toFixed(1),
        ),
        features: c.features,
      })),
    );

    writeFileSync(
      join(OUT, 'README.md'),
      [
        '# Preference round 1 — listen first',
        '',
        'Play only `midi/{A-E}/{P-T}.mid`.',
        'Do not open `_analyst/KEY_DO_NOT_SHOW.json` until rankings are saved.',
        '',
        'For each progression, fill `worksheets/{id}.json`:',
        '',
        '- `ranking`: e.g. `"Q > S > P > T > R"`',
        '- each candidate: Overall / Voicing / Voice Leading / Register / Naturalness (0–100)',
        '- `comment` is optional',
        '',
        'Then run `npm run preference:analyze`.',
        '',
      ].join('\n'),
    );

    writeJson(join(OUT, 'pairs.json'), {
      instruction: 'Generated after worksheets have rankings. Do not invent pairs by hand.',
      pairs: [],
    });
  });
});
