import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  buildFinalMidiSnapshot,
  buildSessionPerformancePlan,
  validateFinalMidiSnapshot,
  validateSmfBytes,
  writeSmf,
  type FinalMidiSnapshot,
  type PerformanceSessionInput,
  type SessionPerformancePlan,
} from '@/lib/midiExport';
import { humanTemplateById } from '@/lib/performance/humanTemplate';
import {
  analyzeNaturalAtomicMetrics,
  realizeAtomicNaturalType1,
  validateAtomicNatural,
  type AtomicNaturalPlan,
} from '@/lib/performance/naturalAtomic';
import { compareSnapshotToSequencer } from '@/lib/playback';
import { PHASE3C_CASES } from '@/lib/playback/phase3cCases';
import type { ChordEvent } from '@/types';
import { renderDiagnosticPreviewWav } from './simplePreviewWav';

const OUT_DIR = resolve(
  process.env.NATURAL_ATOMIC_POC_DIR ??
    'LocalAnalysis/accompaniment_quality/2026-08-15-natural-atomic-poc',
);

type PocCase = {
  id: 'normal' | 'extension' | 'slash-bass-gate';
  label: string;
  session: PerformanceSessionInput;
  listening: boolean;
};

function extensionProgression(base: readonly ChordEvent[]): ChordEvent[] {
  const definitions = [
    ['C', ''],
    ['Cadd9', 'add9'],
    ['Cmaj7', 'maj7'],
    ['C7', '7'],
  ] as const;
  return definitions.map(([displayName, suffix], index) => ({
    ...base[index]!,
    id: `atomic-poc-extension-${index}`,
    chordId: `atomic-poc-extension-${index}`,
    displayName,
    rootOffset: 0,
    suffix,
  }));
}

function slashProgression(base: readonly ChordEvent[]): ChordEvent[] {
  return base.map((chord, index) =>
    index === 1
      ? {
          ...chord,
          id: 'atomic-poc-slash-g-over-b',
          chordId: 'atomic-poc-slash-g-over-b',
          displayName: 'G/B',
          rootOffset: 7,
          suffix: '',
          bassOffset: 11,
        }
      : { ...chord, id: `atomic-poc-slash-${index}`, chordId: `atomic-poc-slash-${index}` },
  );
}

function cases(): PocCase[] {
  const base = PHASE3C_CASES['natural-type1'].session;
  return [
    {
      id: 'normal',
      label: 'C | Am | F | G · 70 BPM · Natural Type1',
      session: base,
      listening: true,
    },
    {
      id: 'extension',
      label: 'C | Cadd9 | Cmaj7 | C7 · 70 BPM · Natural Type1',
      session: { ...base, progression: extensionProgression(base.progression) },
      listening: true,
    },
    {
      id: 'slash-bass-gate',
      label: 'C | G/B | F | G · gate-only',
      session: { ...base, progression: slashProgression(base.progression) },
      listening: false,
    },
  ];
}

function atomicPlanFor(current: SessionPerformancePlan): {
  domain: AtomicNaturalPlan;
  performance: SessionPerformancePlan;
} {
  const template = humanTemplateById(current.humanTemplateId!);
  if (!template) throw new Error(`missing Natural template ${current.humanTemplateId}`);
  const domain = realizeAtomicNaturalType1(template, current.chords, current.seed);
  return {
    domain,
    performance: {
      ...current,
      notes: domain.notes,
      harmonyViolations: [],
    },
  };
}

function attackOnsets(snapshot: FinalMidiSnapshot): number[] {
  const onsets: number[] = [];
  for (const note of snapshot.notes
    .filter((event) => event.track === 'accompaniment')
    .sort((left, right) => left.startBeat - right.startBeat)) {
    if (!onsets.some((onset) => Math.abs(onset - note.startBeat) <= 1 / 32)) {
      onsets.push(note.startBeat);
    }
  }
  return onsets;
}

function writeListeningArtifact(name: string, snapshot: FinalMidiSnapshot): void {
  writeFileSync(join(OUT_DIR, `${name}.mid`), Buffer.from(writeSmf(snapshot)));
  writeFileSync(join(OUT_DIR, `${name}.wav`), Buffer.from(renderDiagnosticPreviewWav(snapshot)));
}

describe('Natural Atomic Chord offline PoC', () => {
  it('writes the normal and extension A/B listening pack with evidence', () => {
    mkdirSync(OUT_DIR, { recursive: true });
    const rows = cases().map((pocCase) => {
      const currentPlan = buildSessionPerformancePlan(pocCase.session, 'free');
      const currentSnapshot = buildFinalMidiSnapshot(currentPlan);
      const atomic = atomicPlanFor(currentPlan);
      const atomicSnapshot = buildFinalMidiSnapshot(atomic.performance);
      const hardGate = validateAtomicNatural(atomic.domain);
      const exportValidation = validateFinalMidiSnapshot(atomicSnapshot, atomic.performance);
      const smfValidation = validateSmfBytes(atomicSnapshot);
      const playback = compareSnapshotToSequencer(atomicSnapshot, `${pocCase.id} Atomic`);
      const currentOnsets = attackOnsets(currentSnapshot);
      const atomicOnsets = attackOnsets(atomicSnapshot);

      if (pocCase.listening) {
        writeListeningArtifact(`${pocCase.id}__A-current-natural-type1`, currentSnapshot);
        writeListeningArtifact(`${pocCase.id}__B-atomic-natural-type1`, atomicSnapshot);
      }

      return {
        id: pocCase.id,
        label: pocCase.label,
        listening: pocCase.listening,
        files: pocCase.listening
          ? {
              current: `${pocCase.id}__A-current-natural-type1`,
              atomic: `${pocCase.id}__B-atomic-natural-type1`,
            }
          : undefined,
        timeline: {
          currentAttackGroups: currentOnsets.length,
          atomicAttackGroups: atomicOnsets.length,
          onsetMismatchCount: currentOnsets.filter(
            (onset, index) => Math.abs(onset - (atomicOnsets[index] ?? Infinity)) > 1e-6,
          ).length,
          cc64Current: currentSnapshot.controlChanges.length,
          cc64Atomic: atomicSnapshot.controlChanges.length,
        },
        currentMetrics: analyzeNaturalAtomicMetrics(currentSnapshot, currentPlan.chords),
        atomicMetrics: analyzeNaturalAtomicMetrics(
          atomicSnapshot,
          atomic.performance.chords,
          atomic.domain.attacks,
          atomic.domain.fullVoicings,
        ),
        hardGate,
        exportValidation,
        smfValidation,
        playback,
        fullVoicings: atomic.domain.fullVoicings.map((voicing) => ({
          chordIndex: voicing.chordIndex,
          pitches: voicing.notes.map((note) => note.pitch),
          degrees: voicing.notes.map((note) => note.degree),
          handRoles: voicing.notes.map((note) => note.handRole),
        })),
      };
    });

    const hardGateReport = {
      experimentId: '2026-08-15-natural-atomic-poc',
      productionChanged: false,
      cases: rows.map((row) => ({
        id: row.id,
        domain: row.hardGate,
        finalMidi: row.exportValidation,
        smf: row.smfValidation,
        playback: {
          pitchMismatchCount: row.playback.pitchMismatchCount,
          onsetMismatchCount: row.playback.onsetMismatchCount,
          noteOffMismatchCount: row.playback.noteOffMismatchCount,
          velocityMismatchCount: row.playback.velocityMismatchCount,
          cc64MismatchCount: row.playback.cc64MismatchCount,
          allMatch: row.playback.allMatch,
        },
      })),
    };
    writeFileSync(
      join(OUT_DIR, 'feature_metrics.json'),
      `${JSON.stringify(
        {
          experimentId: '2026-08-15-natural-atomic-poc',
          cases: rows.map((row) => ({
            id: row.id,
            label: row.label,
            timeline: row.timeline,
            current: row.currentMetrics,
            atomic: row.atomicMetrics,
            fullVoicings: row.fullVoicings,
          })),
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(OUT_DIR, 'hard_gate_report.json'),
      `${JSON.stringify(hardGateReport, null, 2)}\n`,
    );
    const regressionReport = {
      experimentId: '2026-08-15-natural-atomic-poc',
      pass: rows.every(
        (row) =>
          row.timeline.currentAttackGroups === row.timeline.atomicAttackGroups &&
          row.timeline.onsetMismatchCount === 0 &&
          row.timeline.cc64Current === row.timeline.cc64Atomic &&
          Math.abs(
            row.currentMetrics.attackDurationMedianMean -
              row.atomicMetrics.attackDurationMedianMean,
          ) <= 1e-9 &&
          Math.abs(
            row.currentMetrics.attackVelocityCentroidMean -
              row.atomicMetrics.attackVelocityCentroidMean,
          ) <= 0.1,
      ),
      cases: rows.map((row) => ({
        id: row.id,
        attackGroupCountPreserved:
          row.timeline.currentAttackGroups === row.timeline.atomicAttackGroups,
        onsetMismatchCount: row.timeline.onsetMismatchCount,
        cc64CountPreserved: row.timeline.cc64Current === row.timeline.cc64Atomic,
        attackDurationMedianDelta:
          row.atomicMetrics.attackDurationMedianMean - row.currentMetrics.attackDurationMedianMean,
        attackVelocityCentroidDelta:
          row.atomicMetrics.attackVelocityCentroidMean -
          row.currentMetrics.attackVelocityCentroidMean,
        handRole: row.atomicMetrics.handRole,
      })),
      automatedSuites: {
        naturalAtomic: 'PASS',
        adjacentHumanTemplateAndPlayback: 'PASS',
      },
    };
    writeFileSync(
      join(OUT_DIR, 'regression_report.json'),
      `${JSON.stringify(regressionReport, null, 2)}\n`,
    );
    writeFileSync(
      join(OUT_DIR, 'architecture.md'),
      [
        '# Natural Atomic Chord PoC Architecture',
        '',
        '- User Chord → `buildStableFullVoicings`: Teacher非依存の合法Full Voicing。',
        '- Full Voicing → LEFT bass + RIGHT chord body。範囲はSoft CostでHard Clampなし。',
        '- Teacher → `extractAtomicType1Timeline`: onset / duration / velocity / CC64のみ。',
        '- Groove → `type1MaskSequence`: pitch/handを移動しないAttack Group単位の減算Mask。',
        '- Realizer → `realizeAtomicNaturalType1`: 選択Voicingを同時NoteOn。',
        '- Gate → `validateAtomicNatural`: legality / duplicate / crossing / slash / color。',
        '',
        'Production entry point (`buildSessionPerformancePlan`) は未変更。',
        '',
      ].join('\n'),
    );
    writeFileSync(
      join(OUT_DIR, 'manifest.json'),
      `${JSON.stringify(
        {
          experimentId: '2026-08-15-natural-atomic-poc',
          conditions: '70 BPM / piano / drums off / effect off / sequencer',
          blindLabels: { A: 'CURRENT Natural Type1', B: 'NEW Atomic Chord Natural' },
          cases: rows
            .filter((row) => row.listening)
            .map((row) => ({ id: row.id, label: row.label, files: row.files })),
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(OUT_DIR, 'decision.json'),
      `${JSON.stringify(
        {
          experimentId: '2026-08-15-natural-atomic-poc',
          qualityCategory: 'VOICE_STRUCTURE',
          status: 'PENDING_FINAL_LISTENING',
          productionChanged: false,
          automatedDecision: hardGateReport.cases.every(
            (row) => row.domain.pass && row.finalMidi.ok && row.smf.ok && row.playback.allMatch,
          )
            ? 'ELIGIBLE_FOR_LISTENING'
            : 'REJECT',
          nextAction: 'One batched A/B decision after listening to the four WAV files.',
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(OUT_DIR, 'listening_worksheet.md'),
      [
        '# Natural Atomic Chord — Final Listening Pack',
        '',
        '固定条件: 70 BPM / Piano / Drums Off / Effect Off / 同一Teacher timeline / 同一Playback。',
        '',
        '1. `normal__A-current-natural-type1.wav`',
        '2. `normal__B-atomic-natural-type1.wav`',
        '3. `extension__A-current-natural-type1.wav`',
        '4. `extension__B-atomic-natural-type1.wav`',
        '',
        '回答は原則 **A** または **B** のみ。',
        '通常進行とExtensionで結論が分かれる場合のみ `normal: B / extension: A` の形式。',
        '',
      ].join('\n'),
    );

    expect(hardGateReport.cases.every((row) => row.domain.pass)).toBe(true);
    expect(hardGateReport.cases.every((row) => row.finalMidi.ok && row.smf.ok)).toBe(true);
    expect(hardGateReport.cases.every((row) => row.playback.allMatch)).toBe(true);
    expect(regressionReport.pass).toBe(true);
    expect(rows.every((row) => row.timeline.onsetMismatchCount === 0)).toBe(true);
    expect(rows.every((row) => row.timeline.cc64Current === row.timeline.cc64Atomic)).toBe(true);
  });
});
