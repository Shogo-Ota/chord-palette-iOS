/**
 * Accompaniment quality isolation artifacts.
 *
 * Produces the three references needed to separate Teacher, retargeting and playback:
 *   A. reconstructed raw Teacher performance (teacher timing/pitch/velocity/duration)
 *   B. current Production Final MIDI after user-chord retargeting
 *   C. the native sampler plan signature/event manifest for that same Final MIDI
 *
 * Run: npm run audition:isolate
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  buildFinalMidiSnapshot,
  buildSessionPerformancePlan,
  writeSmf,
  type FinalMidiControlChange,
  type FinalMidiNote,
  type FinalMidiSnapshot,
  type PerformanceSessionInput,
  type SessionPerformancePlan,
} from '@/lib/midiExport';
import { validateStructure, validateCase } from '@/lib/midiQa/validate';
import type { QaProgressionId } from '@/lib/midiQa/progressions';
import { computeMetrics } from '@/lib/performance/analysis/metrics';
import {
  humanTemplateById,
  reconstructTeacherPitch,
  teacherVelocity,
  type HumanMidiTemplate,
} from '@/lib/performance/humanTemplate';
import { PHASE3C_CASES } from '@/lib/playback/phase3cCases';
import { buildNativePlaybackPlan, snapshotToMidiEvents } from '@/lib/playback';
import type { AccompanimentPattern, ChordEvent } from '@/types';
import { renderDiagnosticPreviewWav } from './simplePreviewWav';

const OUT_DIR = resolve(process.env.QUALITY_ISOLATION_DIR ?? 'LocalAnalysis/quality_isolation');
const LARGE_JUMP = 12;
const EPS = 1e-6;

type QualityCase = {
  id: string;
  label: string;
  progressionId: QaProgressionId;
  session: PerformanceSessionInput;
  listening: boolean;
};

type Group = {
  beat: number;
  pitches: number[];
  velocities: number[];
  durations: number[];
};

function cloneSession(base: PerformanceSessionInput, variantId: string): PerformanceSessionInput {
  return {
    ...base,
    accompanimentVariant: variantId,
    progression: base.progression.map((chord) => ({ ...chord })),
  };
}

function slashProgression(base: readonly ChordEvent[]): ChordEvent[] {
  return base.map((chord, index) =>
    index === 1
      ? {
          ...chord,
          id: 'quality-slash-g-over-b',
          chordId: 'quality-slash-g-over-b',
          displayName: 'G/B',
          rootOffset: 7,
          suffix: '',
          bassOffset: 11,
        }
      : { ...chord, id: `quality-slash-${index}` },
  );
}

function qualityCases(): QualityCase[] {
  const natural = PHASE3C_CASES['natural-type1'].session;
  const variation = PHASE3C_CASES['variation-type1'].session;
  return [
    ...['natural.type1', 'natural.type2', 'natural.type3'].map((variantId, index): QualityCase => ({
      id: `public-natural-type${index + 1}`,
      label: `Public Natural Type ${index + 1} · C | Am | F | G`,
      progressionId: 'A',
      session: cloneSession(natural, variantId),
      listening: true,
    })),
    ...['arpeggio.type1', 'arpeggio.type2', 'arpeggio.type3'].map(
      (variantId, index): QualityCase => ({
        id: `public-variation-type${index + 1}`,
        label: `Public Variation Type ${index + 1} · D | Bm | G | A`,
        progressionId: 'B',
        session: cloneSession(variation, variantId),
        listening: true,
      }),
    ),
    {
      id: 'gate-slash-bass-natural-type1',
      label: 'Gate only · Natural Type 1 · C | G/B | F | G',
      progressionId: 'A',
      session: {
        ...cloneSession(natural, 'natural.type1'),
        progression: slashProgression(natural.progression),
      },
      listening: false,
    },
  ];
}

function clampMidi(value: number): number {
  return Math.max(0, Math.min(127, Math.round(value)));
}

function teacherSnapshot(template: HumanMidiTemplate, bpm: number): FinalMidiSnapshot {
  const beatsPerBar = template.meter.beatsPerBar;
  const notes: FinalMidiNote[] = [];

  for (const attack of template.attacks) {
    const startBeat =
      (attack.musicalBarInLoop - 1) * beatsPerBar +
      attack.beatInMusicalBar +
      (attack.timingOffsetBeats ?? 0);
    for (const note of attack.notes) {
      const durationBeat = note.durationBeats ?? 0.5;
      if (durationBeat <= 0) continue;
      if (note.sourceRootPc == null || note.intervalFromRoot == null) {
        throw new Error(
          `${template.id}: teacher pitch cannot be reconstructed at bar ${attack.musicalBarInLoop}`,
        );
      }
      notes.push({
        startBeat,
        durationBeat,
        pitch: clampMidi(reconstructTeacherPitch(note.sourceRootPc, note.intervalFromRoot)),
        velocity: teacherVelocity(note),
        channel: 0,
        track: 'accompaniment',
      });
    }
  }

  const controlChanges: FinalMidiControlChange[] = (template.pedalEvents ?? []).map((pedal) => ({
    startBeat: (pedal.musicalBar - 1) * beatsPerBar + pedal.beatInMusicalBar,
    controller: 64,
    value: pedal.value,
    channel: 0,
  }));

  return {
    bpm,
    beatsPerBar,
    timeSignature: {
      numerator: beatsPerBar,
      denominator: template.meter.beatUnit,
    },
    totalBeats: template.loopBars * beatsPerBar,
    instrumentId: 'piano',
    gmProgram: 0,
    drumMode: 'off',
    notes: notes.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch),
    controlChanges: controlChanges.sort((a, b) => a.startBeat - b.startBeat),
    markers: Array.from({ length: template.loopBars }, (_, index) => ({
      startBeat: index * beatsPerBar,
      label: `Teacher bar ${index + 1}`,
    })),
  };
}

function mean(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function stdDev(values: readonly number[]): number {
  const center = mean(values);
  return values.length ? Math.sqrt(mean(values.map((value) => (value - center) ** 2))) : 0;
}

function groupsFor(snapshot: FinalMidiSnapshot): Group[] {
  const notes = snapshot.notes
    .filter((note) => note.track === 'accompaniment')
    .sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  const groups: Group[] = [];
  for (const note of notes) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.beat - note.startBeat) <= 1 / 32) {
      last.pitches.push(note.pitch);
      last.velocities.push(note.velocity);
      last.durations.push(note.durationBeat);
    } else {
      groups.push({
        beat: note.startBeat,
        pitches: [note.pitch],
        velocities: [note.velocity],
        durations: [note.durationBeat],
      });
    }
  }
  return groups;
}

function movementBetween(left: Group, right: Group): number {
  const a = [...left.pitches].sort((x, y) => x - y);
  const b = [...right.pitches].sort((x, y) => x - y);
  const count = Math.min(a.length, b.length);
  if (count === 0) return 0;
  let movement = 0;
  for (let index = 0; index < count; index++) {
    movement += Math.abs(a[index]! - b[index]!);
  }
  return movement / count;
}

function duplicateCount(snapshot: FinalMidiSnapshot): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const note of snapshot.notes.filter((event) => event.track === 'accompaniment')) {
    const key = `${note.startBeat.toFixed(6)}:${note.pitch}`;
    if (seen.has(key)) duplicates++;
    seen.add(key);
  }
  return duplicates;
}

function overlappingSamePitchCount(snapshot: FinalMidiSnapshot): number {
  const notes = snapshot.notes.filter((event) => event.track === 'accompaniment');
  let overlaps = 0;
  for (let leftIndex = 0; leftIndex < notes.length; leftIndex++) {
    const left = notes[leftIndex]!;
    const leftEnd = left.startBeat + left.durationBeat;
    for (let rightIndex = leftIndex + 1; rightIndex < notes.length; rightIndex++) {
      const right = notes[rightIndex]!;
      if (left.pitch !== right.pitch) continue;
      const rightEnd = right.startBeat + right.durationBeat;
      if (left.startBeat < rightEnd - EPS && right.startBeat < leftEnd - EPS) {
        overlaps++;
      }
    }
  }
  return overlaps;
}

function structuralStats(snapshot: FinalMidiSnapshot) {
  const notes = snapshot.notes.filter((note) => note.track === 'accompaniment');
  const groups = groupsFor(snapshot);
  const movements = groups.slice(1).map((group, index) => movementBetween(groups[index]!, group));
  const bassJumps = groups
    .slice(1)
    .map((group, index) =>
      Math.abs(Math.min(...group.pitches) - Math.min(...groups[index]!.pitches)),
    );
  const topJumps = groups
    .slice(1)
    .map((group, index) =>
      Math.abs(Math.max(...group.pitches) - Math.max(...groups[index]!.pitches)),
    );
  const centers = groups.map(
    (group) => (Math.min(...group.pitches) + Math.max(...group.pitches)) / 2,
  );
  const centerJumps = centers.slice(1).map((center, index) => Math.abs(center - centers[index]!));
  const velocities = notes.map((note) => note.velocity);
  const durations = notes.map((note) => note.durationBeat);
  const timingDeviations = groups.map((group) =>
    Math.abs(group.beat - Math.round(group.beat * 4) / 4),
  );
  const pitches = notes.map((note) => note.pitch);

  return {
    noteCount: notes.length,
    attackGroupCount: groups.length,
    attackGroupsPerBar:
      snapshot.totalBeats > 0 ? groups.length / (snapshot.totalBeats / snapshot.beatsPerBar) : 0,
    pitchMin: pitches.length ? Math.min(...pitches) : 0,
    pitchMax: pitches.length ? Math.max(...pitches) : 0,
    duplicateSimultaneousMidi: duplicateCount(snapshot),
    overlappingSamePitch: overlappingSamePitchCount(snapshot),
    voiceCountChanges: groups
      .slice(1)
      .filter((group, index) => group.pitches.length !== groups[index]!.pitches.length).length,
    totalVoiceMovement: movements.reduce((sum, value) => sum + value, 0),
    meanVoiceMovement: mean(movements),
    maxConsecutiveAttackBassJump: bassJumps.length ? Math.max(...bassJumps) : 0,
    maxConsecutiveAttackTopJump: topJumps.length ? Math.max(...topJumps) : 0,
    maxConsecutiveAttackRegisterCenterJump: centerJumps.length ? Math.max(...centerJumps) : 0,
    velocityMean: mean(velocities),
    velocityStdDev: stdDev(velocities),
    durationMean: mean(durations),
    durationStdDev: stdDev(durations),
    timingDeviationMean: mean(timingDeviations),
    timingDeviationMax: timingDeviations.length ? Math.max(...timingDeviations) : 0,
    cc64Count: snapshot.controlChanges.filter((event) => event.controller === 64).length,
  };
}

/**
 * Release "major register jump" means a chord-to-chord voicing discontinuity, not
 * movement between a full chord and a deliberate one-note figure inside the same bar.
 * Represent each chord by its fullest attack (earliest wins ties), then compare those.
 */
function chordTransitionStats(snapshot: FinalMidiSnapshot, plan: SessionPerformancePlan) {
  const groups = groupsFor(snapshot);
  const representatives = plan.chords
    .map(
      (chord) =>
        groups
          .filter(
            (group) =>
              group.beat >= chord.startBeat - EPS &&
              group.beat < chord.startBeat + chord.durationBeats - EPS,
          )
          .sort(
            (left, right) => right.pitches.length - left.pitches.length || left.beat - right.beat,
          )[0],
    )
    .filter((group): group is Group => group !== undefined);
  const movements = representatives
    .slice(1)
    .map((group, index) => movementBetween(representatives[index]!, group));
  const bassJumps = representatives
    .slice(1)
    .map((group, index) =>
      Math.abs(Math.min(...group.pitches) - Math.min(...representatives[index]!.pitches)),
    );
  const topJumps = representatives
    .slice(1)
    .map((group, index) =>
      Math.abs(Math.max(...group.pitches) - Math.max(...representatives[index]!.pitches)),
    );
  const centerJumps = representatives.slice(1).map((group, index) => {
    const previous = representatives[index]!;
    const center = (Math.min(...group.pitches) + Math.max(...group.pitches)) / 2;
    const previousCenter = (Math.min(...previous.pitches) + Math.max(...previous.pitches)) / 2;
    return Math.abs(center - previousCenter);
  });
  return {
    representativeBeats: representatives.map((group) => group.beat),
    representativeVoiceCounts: representatives.map((group) => group.pitches.length),
    meanVoiceMovement: mean(movements),
    maxBassJump: bassJumps.length ? Math.max(...bassJumps) : 0,
    maxTopJump: topJumps.length ? Math.max(...topJumps) : 0,
    maxRegisterCenterJump: centerJumps.length ? Math.max(...centerJumps) : 0,
  };
}

function slashBassViolations(snapshot: FinalMidiSnapshot, plan: SessionPerformancePlan): string[] {
  const groups = groupsFor(snapshot);
  const violations: string[] = [];
  plan.progression.forEach((chord, index) => {
    if (chord.bassOffset == null || chord.bassOffset === chord.rootOffset) return;
    const perf = plan.chords[index];
    if (!perf) return;
    const inside = groups.filter(
      (group) =>
        group.beat >= perf.startBeat - EPS &&
        group.beat < perf.startBeat + perf.durationBeats - EPS,
    );
    for (const group of inside) {
      const lowest = Math.min(...group.pitches);
      if (((lowest % 12) + 12) % 12 !== chord.bassOffset) {
        violations.push(`${chord.displayName}@${group.beat.toFixed(3)} lowest=${lowest}`);
      }
    }
  });
  return violations;
}

function playbackMismatchCount(snapshot: FinalMidiSnapshot): number {
  const expected = snapshot.notes
    .flatMap((note) => [
      `${note.startBeat.toFixed(6)}:on:${note.channel}:${note.pitch}:${note.velocity}`,
      `${(note.startBeat + note.durationBeat).toFixed(6)}:off:${note.channel}:${note.pitch}:0`,
    ])
    .concat(
      snapshot.controlChanges.map(
        (event) =>
          `${event.startBeat.toFixed(6)}:cc:${event.channel}:${event.controller}:${event.value}`,
      ),
    )
    .sort();
  const actual = snapshotToMidiEvents(snapshot)
    .map((event) => `${event.beat.toFixed(6)}:${event.kind}:${event.channel}:${event.a}:${event.b}`)
    .sort();
  const size = Math.max(expected.length, actual.length);
  let mismatches = 0;
  for (let index = 0; index < size; index++) {
    if (expected[index] !== actual[index]) mismatches++;
  }
  return mismatches;
}

function roundNumbers(value: unknown): unknown {
  if (typeof value === 'number') return Number(value.toFixed(6));
  if (Array.isArray(value)) return value.map(roundNumbers);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, roundNumbers(child)]),
    );
  }
  return value;
}

function fileStem(id: string): string {
  return id.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
}

function listeningWorksheet(
  cases: readonly {
    id: string;
    label: string;
    teacherFile: string;
    finalFile: string;
    teacherPreview: string;
    finalPreview: string;
  }[],
): string {
  const sections = cases
    .map(
      (item) => `## ${item.label}

1. Raw Teacher preview: \`${item.teacherPreview}\`
2. Final MIDI preview: \`${item.finalPreview}\`
3. App: NEW Samplerで同じTypeを再生

MIDI対応DAWがある場合は \`${item.teacherFile}\` と \`${item.finalFile}\` も使用できます。

- Raw Teacher musicality / groove: PASS / FAIL
- Final MIDI harmony / voicing / groove: PASS / FAIL
- NEW Sampler sound / playback: PASS / FAIL
- 主因: Teacher / Retarget / Playback / 複数
- コメント:
`,
    )
    .join('\n');
  return `# Accompaniment Quality Isolation Listening

## 固定手順

- ヘッドホンを使用し、DAWと端末の聴感音量を揃える。
- Raw Teacherは「教師の弾き方」、Final MIDIは「ユーザーコードへの移植結果」、
  NEW Samplerは「Final MIDIの実機再生」を評価する。
- preview WAVはTeacher/Retargetを同一簡易音源で比較する診断用。音色品質の評価には使用しない。
- 音源差だけでTeacher/RetargetをFAILにしない。和音、声部、タイミング、間、強弱を先に判定する。

${sections}`;
}

describe('accompaniment quality isolation artifacts', () => {
  it('writes teacher, Final MIDI and native-plan evidence for the public six Types', () => {
    mkdirSync(OUT_DIR, { recursive: true });
    const manifestCases: unknown[] = [];
    const listeningCases: {
      id: string;
      label: string;
      teacherFile: string;
      finalFile: string;
      teacherPreview: string;
      finalPreview: string;
    }[] = [];

    for (const qualityCase of qualityCases()) {
      const plan = buildSessionPerformancePlan(qualityCase.session, 'free');
      const finalSnapshot = buildFinalMidiSnapshot(plan);
      if (!plan.humanTemplateId) {
        throw new Error(`${qualityCase.id}: expected a Human MIDI Template`);
      }
      const template = humanTemplateById(plan.humanTemplateId);
      if (!template) {
        throw new Error(`${qualityCase.id}: unknown template ${plan.humanTemplateId}`);
      }
      const rawTeacher = teacherSnapshot(template, qualityCase.session.tempoBpm);
      const nativePlan = buildNativePlaybackPlan(finalSnapshot, {
        loop: true,
      });
      const stem = fileStem(qualityCase.id);
      const teacherFile = `${stem}__a-raw-teacher.mid`;
      const finalFile = `${stem}__b-final-midi.mid`;
      const teacherPreview = `${stem}__a-raw-teacher-preview.wav`;
      const finalPreview = `${stem}__b-final-midi-preview.wav`;
      writeFileSync(join(OUT_DIR, teacherFile), Buffer.from(writeSmf(rawTeacher)));
      writeFileSync(join(OUT_DIR, finalFile), Buffer.from(writeSmf(finalSnapshot)));
      writeFileSync(join(OUT_DIR, teacherPreview), renderDiagnosticPreviewWav(rawTeacher));
      writeFileSync(join(OUT_DIR, finalPreview), renderDiagnosticPreviewWav(finalSnapshot));

      const teacherStats = structuralStats(rawTeacher);
      const finalStats = structuralStats(finalSnapshot);
      const chordTransitions = chordTransitionStats(finalSnapshot, plan);
      const qa = validateCase(
        qualityCase.id,
        qualityCase.session.accompanimentPattern as AccompanimentPattern,
        String(qualityCase.session.accompanimentVariant),
        qualityCase.progressionId,
        finalSnapshot,
        plan,
      );
      const structureFailures = validateStructure(finalSnapshot);
      const slashViolations = slashBassViolations(finalSnapshot, plan);
      const pitchEventMismatches = playbackMismatchCount(finalSnapshot);
      const cc64Loss = Math.max(0, teacherStats.cc64Count - finalStats.cc64Count);
      const omissionCount = Math.max(0, teacherStats.noteCount - finalStats.noteCount);
      const majorRegisterJump =
        chordTransitions.maxBassJump >= LARGE_JUMP ||
        chordTransitions.maxTopJump >= LARGE_JUMP ||
        chordTransitions.maxRegisterCenterJump >= LARGE_JUMP;
      const hardFailures = [
        ...(plan.harmonyViolations ?? []).map(
          (violation) => `harmony:${JSON.stringify(violation)}`,
        ),
        ...structureFailures.map((failure) => `${failure.category}:${failure.code}`),
        ...(finalStats.duplicateSimultaneousMidi > 0
          ? [`duplicate_simultaneous_midi:${finalStats.duplicateSimultaneousMidi}`]
          : []),
        ...slashViolations.map((message) => `slash_bass:${message}`),
        ...(pitchEventMismatches > 0 ? [`playback_event_mismatch:${pitchEventMismatches}`] : []),
        ...(cc64Loss > 0 ? [`cc64_loss:${cc64Loss}`] : []),
        ...(majorRegisterJump ? ['major_register_jump'] : []),
      ];
      const metrics = computeMetrics(plan.notes, plan.chords);

      manifestCases.push({
        id: qualityCase.id,
        label: qualityCase.label,
        listening: qualityCase.listening,
        pattern: qualityCase.session.accompanimentPattern,
        variantId: qualityCase.session.accompanimentVariant,
        progression: qualityCase.session.progression.map((chord) => chord.displayName),
        bpm: qualityCase.session.tempoBpm,
        templateId: plan.humanTemplateId,
        files: {
          rawTeacher: teacherFile,
          finalMidi: finalFile,
          rawTeacherPreview: teacherPreview,
          finalMidiPreview: finalPreview,
        },
        nativeSampler: {
          signature: nativePlan.signature,
          eventCount: nativePlan.midiEvents.length,
          noteOnCount: nativePlan.noteOnCount,
          controlChangeCount: nativePlan.controlChangeCount,
          pitchEventMismatches,
        },
        comparison: {
          teacher: teacherStats,
          finalMidi: finalStats,
          chordTransitions,
          omissionCount,
          cc64Loss,
        },
        hardGate: {
          pass: hardFailures.length === 0,
          failures: hardFailures,
          slashBassViolations: slashViolations,
          harmonyViolationCount: plan.harmonyViolations?.length ?? 0,
          duplicateSimultaneousMidi: finalStats.duplicateSimultaneousMidi,
          majorRegisterJump,
          voiceCrossing:
            'not observable after MIDI flattening; enforced inside VoiceStructureRealizer',
        },
        diagnosticQa: {
          pass: qa.pass,
          failures: qa.analysis.failures,
        },
        performanceMetrics: metrics,
      });

      if (qualityCase.listening) {
        listeningCases.push({
          id: qualityCase.id,
          label: qualityCase.label,
          teacherFile,
          finalFile,
          teacherPreview,
          finalPreview,
        });
      }
    }

    const manifest = roundNumbers({
      generatedFor: 'Raw Teacher vs Production Final MIDI vs NEW Sampler isolation',
      conditions:
        'piano / drums off / effect off / tier free / public Natural and Variation Type 1-3',
      releaseFrozen: true,
      cases: manifestCases,
    });
    writeFileSync(join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    writeFileSync(
      join(OUT_DIR, 'listening_worksheet.md'),
      listeningWorksheet(listeningCases),
      'utf8',
    );

    expect(listeningCases).toHaveLength(6);
    expect(
      (manifestCases as { nativeSampler: { pitchEventMismatches: number } }[]).every(
        (item) => item.nativeSampler.pitchEventMismatches === 0,
      ),
    ).toBe(true);
  });
});
