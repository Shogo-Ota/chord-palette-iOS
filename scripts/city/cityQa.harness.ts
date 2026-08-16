import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  buildFinalMidiSnapshot,
  validateFinalMidiSnapshot,
  validateSmfBytes,
} from '@/lib/midiExport';
import { CITY_TYPE1_GROOVE, validateCityType1 } from '@/lib/performance/city';
import { compareSnapshotToSequencer } from '@/lib/playback';
import { buildCityPocPerformance, CITY_POC_CANDIDATES, cityPocProgressions } from './pocFixtures';

const OUT_DIR = resolve(process.env.CITY_ANALYSIS_DIR ?? 'LocalAnalysis/city_style');
const TEMPOS = [70, 90, 110] as const;

function sourceFiles(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name);
    return statSync(child).isDirectory()
      ? sourceFiles(child)
      : child.endsWith('.ts')
        ? [child]
        : [];
  });
}

function dependencyAudit() {
  const roots = [resolve('src/lib/performance/city'), resolve('src/lib/performance/chordComping')];
  const forbidden = [
    /LocalAnalysis/i,
    /LocalDatasets/i,
    /pop909/i,
    /groovePreference/i,
    /accompanimentQuality/i,
    /scripts\//i,
    /プラスティック|竹内/,
  ];
  const violations: { file: string; pattern: string }[] = [];
  for (const file of roots.flatMap(sourceFiles)) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        violations.push({
          file: file.replace(resolve('.'), '').replaceAll('\\', '/'),
          pattern: String(pattern),
        });
      }
    }
  }
  return { pass: violations.length === 0, violations };
}

function assetEvidenceMatch() {
  const extracted = JSON.parse(
    readFileSync(resolve('LocalAnalysis/city_style/normalized_groove_asset.json'), 'utf8'),
  ) as {
    attacks: {
      onsetBeat: number;
      durationBeat: number;
      gapToNextAttackBeat: number;
      relativeVelocity: number;
    }[];
    handChordRoll: {
      offsetsBeatByAscendingPitchRank: number[];
      measuredSpreadBeat: number;
    };
  };
  const productionShape = {
    attacks: CITY_TYPE1_GROOVE.attacks.map((attack) => ({
      onsetBeat: attack.onsetBeat,
      durationBeat: attack.durationBeat,
      gapToNextAttackBeat: attack.gapToNextAttackBeat,
      relativeVelocity: attack.relativeVelocity,
    })),
    handChordRoll: CITY_TYPE1_GROOVE.handChordRoll,
  };
  const expectedShape = {
    attacks: extracted.attacks.map((attack) => ({
      onsetBeat: attack.onsetBeat,
      durationBeat: attack.durationBeat,
      gapToNextAttackBeat: attack.gapToNextAttackBeat,
      relativeVelocity: attack.relativeVelocity,
    })),
    handChordRoll: {
      direction: 'ASCENDING',
      offsetsBeatByAscendingPitchRank: extracted.handChordRoll.offsetsBeatByAscendingPitchRank,
      measuredSpreadBeat: extracted.handChordRoll.measuredSpreadBeat,
    },
  };
  return {
    pass: JSON.stringify(productionShape) === JSON.stringify(expectedShape),
    productionShape,
    expectedShape,
  };
}

function musicalSignature(city: ReturnType<typeof buildCityPocPerformance>['city']) {
  return JSON.stringify({
    attacks: city.attacks.map((attack) => ({
      chordIndex: attack.chordIndex,
      slot: attack.cycleAttackIndex,
      onset: attack.onsetBeat,
      duration: attack.durationBeat,
      gap: attack.gapToNextAttackBeat,
      velocity: attack.velocity,
      mask: attack.mask,
      roll: attack.rollSpreadBeat,
    })),
    notes: city.notes.map((note) => ({
      onset: note.timeBeat,
      duration: note.durationBeat,
      pitch: note.pitch,
      velocity: note.velocity,
    })),
  });
}

describe('City Type1 automated QA', () => {
  it('passes hard gates, City QA, tempo regression and sequencer fidelity', () => {
    const hardGateRows = [];
    const cityQaRows = [];
    const tempoRows = [];
    const signatures = new Map<string, string>();

    for (const bpm of TEMPOS) {
      for (const poc of cityPocProgressions()) {
        for (const candidate of CITY_POC_CANDIDATES) {
          const { plan, city } = buildCityPocPerformance(poc, candidate.id, bpm);
          const snapshot = buildFinalMidiSnapshot(plan);
          const hardGate = validateCityType1(city);
          const finalMidi = validateFinalMidiSnapshot(snapshot, plan);
          const smf = validateSmfBytes(snapshot);
          const playback = compareSnapshotToSequencer(snapshot, `${poc.id}/${candidate.id}/${bpm}`);
          const key = `${poc.id}:${candidate.id}`;
          const signature = musicalSignature(city);
          const baseline = signatures.get(key);
          if (baseline == null) signatures.set(key, signature);
          const beatStructureInvariant = baseline == null || baseline === signature;
          const durationSeconds = (snapshot.totalBeats * 60) / bpm;

          hardGateRows.push({
            bpm,
            progressionId: poc.id,
            progression: poc.label,
            candidateId: candidate.id,
            pass: hardGate.pass && finalMidi.ok && smf.ok && playback.allMatch,
            hardGate,
            finalMidi,
            smf,
            playback,
          });
          cityQaRows.push({
            bpm,
            progressionId: poc.id,
            candidateId: candidate.id,
            ...hardGate.cityQa,
            register: hardGate.register,
          });
          tempoRows.push({
            bpm,
            progressionId: poc.id,
            candidateId: candidate.id,
            totalBeats: snapshot.totalBeats,
            durationSeconds,
            beatStructureInvariant,
          });
        }
      }
    }

    const dependencies = dependencyAudit();
    const assetEvidence = assetEvidenceMatch();
    const allHardGatesPass = hardGateRows.every((row) => row.pass);
    const allTempoPass = tempoRows.every(
      (row) => row.beatStructureInvariant && row.totalBeats === 16,
    );
    const allCityQaPass = cityQaRows.every(
      (row) =>
        row.attackCountPass &&
        row.normalizedOnsetPass &&
        row.gateStructurePass &&
        row.restStructurePass &&
        row.accentHierarchyPass &&
        row.velocityContourPass &&
        row.phraseLengthPass &&
        row.atomicAttackGroupPass,
    );

    writeFileSync(
      join(OUT_DIR, 'hard_gate_report.json'),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          pass: allHardGatesPass && dependencies.pass && assetEvidence.pass,
          caseCount: hardGateRows.length,
          dependencyAudit: dependencies,
          assetEvidence,
          rows: hardGateRows,
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(OUT_DIR, 'city_qa_report.json'),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          pass: allCityQaPass,
          caseCount: cityQaRows.length,
          rows: cityQaRows,
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(OUT_DIR, 'tempo_regression.json'),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          pass: allTempoPass,
          tempos: TEMPOS,
          rows: tempoRows,
        },
        null,
        2,
      )}\n`,
    );

    expect(dependencies.violations).toEqual([]);
    expect(assetEvidence.pass).toBe(true);
    expect(hardGateRows.filter((row) => !row.pass)).toEqual([]);
    expect(cityQaRows.filter((row) => !row.atomicAttackGroupPass)).toEqual([]);
    expect(allCityQaPass).toBe(true);
    expect(allTempoPass).toBe(true);
  });
});
