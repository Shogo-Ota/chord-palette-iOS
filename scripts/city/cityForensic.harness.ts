import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { deriveCityGrooveAsset, renderExtractedCityGrooveMarkdown } from './deriveGrooveAsset';
import { analyzeCitySourceMidi, renderCitySourceForensicMarkdown } from './sourceForensic';

const SOURCE_MIDI = resolve(
  process.env.CITY_REFERENCE_MIDI ??
    'LocalDatasets/CommercialSongMidi/City/コード打ち込み　プラスティック・ラブ_竹内 まりや - MIDI.mid',
);
const OUT_DIR = resolve(process.env.CITY_ANALYSIS_DIR ?? 'LocalAnalysis/city_style');

describe('City source MIDI forensic', () => {
  it('re-measures the real source and writes reproducible evidence', () => {
    const bytes = readFileSync(SOURCE_MIDI);
    const report = analyzeCitySourceMidi(bytes, basename(SOURCE_MIDI));

    expect(report.file.ppq).toBeGreaterThan(0);
    expect(report.file.trackCount).toBeGreaterThan(0);
    expect(report.notes.selectedTrackNoteCount).toBeGreaterThan(0);
    expect(report.attacks.count).toBeGreaterThan(0);
    expect(report.grouping.toleranceTicks).toBeGreaterThan(0);
    expect(report.attacks.groups).toHaveLength(report.attacks.count);
    expect(report.attacks.strictSimultaneousCount + report.attacks.rolledAttackCount).toBe(
      report.attacks.count,
    );
    expect(report.file.warnings).toEqual([]);

    const asset = deriveCityGrooveAsset(report);
    expect(asset.attacks).toHaveLength(6);
    expect(asset.attacks.every((attack) => attack.gapToNextAttackBeat > 0)).toBe(true);
    expect(asset.handChordRoll.offsetsBeatByAscendingPitchRank).toEqual([0, 0.00625, 0.0125]);
    expect(asset.attacks.every((attack) => attack.sourceMaskEvidence === 'FULL')).toBe(true);

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(resolve(OUT_DIR, 'source_forensic.json'), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolve(OUT_DIR, 'source_forensic.md'), renderCitySourceForensicMarkdown(report));
    writeFileSync(
      resolve(OUT_DIR, 'normalized_groove_asset.json'),
      `${JSON.stringify(asset, null, 2)}\n`,
    );
    writeFileSync(
      resolve(OUT_DIR, 'normalized_groove_asset.md'),
      renderExtractedCityGrooveMarkdown(asset),
    );
  });
});
