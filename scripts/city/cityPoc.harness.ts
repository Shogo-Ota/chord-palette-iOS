import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { buildFinalMidiSnapshot, writeSmf } from '@/lib/midiExport';
import type { CityType1CandidateId } from '@/lib/performance/city';
import { renderDiagnosticPreviewWav } from '../audition/simplePreviewWav';
import { buildCityPocPerformance, CITY_POC_CANDIDATES, cityPocProgressions } from './pocFixtures';

const OUT_DIR = resolve(process.env.CITY_POC_DIR ?? 'LocalAnalysis/city_style/poc');

describe('City Type1 offline PoC', () => {
  it('writes A/B/C candidates for all four required progressions', () => {
    mkdirSync(OUT_DIR, { recursive: true });
    const files: {
      progressionId: string;
      progression: string;
      candidateId: CityType1CandidateId;
      candidate: string;
      midi: string;
      wav: string;
      noteCount: number;
      attackCount: number;
    }[] = [];

    for (const poc of cityPocProgressions()) {
      for (const candidate of CITY_POC_CANDIDATES) {
        const { plan, city } = buildCityPocPerformance(poc, candidate.id);
        const snapshot = buildFinalMidiSnapshot(plan);
        const baseName = `progression-${poc.id}__${candidate.fileToken}`;
        const midi = `${baseName}.mid`;
        const wav = `${baseName}.wav`;
        writeFileSync(join(OUT_DIR, midi), Buffer.from(writeSmf(snapshot)));
        writeFileSync(join(OUT_DIR, wav), Buffer.from(renderDiagnosticPreviewWav(snapshot)));
        files.push({
          progressionId: poc.id,
          progression: poc.label,
          candidateId: candidate.id,
          candidate: candidate.label,
          midi,
          wav,
          noteCount: city.notes.length,
          attackCount: city.attacks.length,
        });
      }
    }

    expect(files).toHaveLength(12);
    expect(files.every((file) => file.attackCount === 24)).toBe(true);
    writeFileSync(
      join(OUT_DIR, 'manifest.json'),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          style: 'City',
          pattern: 'City Type1',
          instrument: 'Piano',
          bpm: 90,
          files,
        },
        null,
        2,
      )}\n`,
    );
  });
});
