/**
 * Off-device audition harness — Step 1 of the 音質 investigation.
 *
 * Writes the EXACT notes the app would play (`buildSessionPerformancePlan` →
 * `buildFinalMidiSnapshot`) as .mid files, plus a metrics report, so a take can be
 * heard in a DAW with a good piano instead of waiting 10–40 minutes for a device
 * build. That separates the two questions that were previously tangled:
 *
 *   - the .mid sounds good in a DAW  → the generation layer is fine, playback is the fault
 *   - the .mid sounds bad in a DAW   → the generation layer is at fault too
 *
 * It runs under Jest because that is the project's only configured TypeScript
 * runtime with the app's module resolution, so the harness renders through exactly
 * the code the app ships. It is NOT part of the test suite: the file is named
 * `.harness.ts`, which the default `testMatch` ignores, and it is invoked through
 * `scripts/audition/jest.audition.config.js` (`npm run audition`).
 *
 * Env:
 *   AUDITION_OUT   output directory (default `audition-out/`)
 *   AUDITION_PROG  evaluation progression id A–D (default A = C - G - Am - F)
 *   AUDITION_BPM   override the progression's tempo (default: its own)
 *   AUDITION_DRUM  off | kick | full (default off, so the piano is heard alone)
 *   AUDITION_BEAT  4 | 8 | 16 (default 8)
 *   AUDITION_TIER  free | pro (default pro — the fullest reading)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { DrumBeat } from '@/lib/drum/drumBeat';
import type { DrumMode } from '@/lib/drum/drumMode';
import {
  buildFinalMidiSnapshot,
  buildSessionPerformancePlan,
  writeSmf,
  type PerformanceSessionInput,
} from '@/lib/midiExport';
import { EVAL_PROGRESSIONS } from '@/lib/performance/analysis/fixtures';
import { computeMetrics } from '@/lib/performance/analysis/metrics';
import {
  analyzePlaybackFidelity,
  CAPTURED_PITCH_MAX,
  CAPTURED_PITCH_MIN,
  SAMPLE_TAIL_SECONDS,
} from '@/lib/performance/analysis/playbackFidelity';
import type { InstrumentEffect } from '@/lib/performance/effect';
import { CORE_PATTERNS } from '@/lib/performance/model/styleCards';
import { offeredVariantsFor, variantsFor } from '@/lib/performance/variants';
import type { Tier } from '@/lib/performance/tier';
import type { AccompanimentPattern, InstrumentId } from '@/types';

const OUT_DIR = resolve(process.env.AUDITION_OUT ?? 'audition-out');
const PROG_ID = (process.env.AUDITION_PROG ?? 'A').toUpperCase();
const DRUM_MODE = (process.env.AUDITION_DRUM ?? 'off') as DrumMode;
const DRUM_BEAT = (process.env.AUDITION_BEAT ?? '8') as DrumBeat;
const TIER = (process.env.AUDITION_TIER ?? 'pro') as Tier;

const PROG = EVAL_PROGRESSIONS.find((p) => p.id === PROG_ID) ?? EVAL_PROGRESSIONS[0]!;
const BPM = Number(process.env.AUDITION_BPM ?? PROG.bpm);

interface Case {
  label: string;
  pattern: AccompanimentPattern;
  variantId: string;
  instrumentId: InstrumentId;
  effect: InstrumentEffect;
}

function sessionFor(c: Case): PerformanceSessionInput {
  return {
    key: PROG.key,
    tempoBpm: BPM,
    grooveId: 'pop8',
    accompanimentPattern: c.pattern,
    accompanimentVariant: c.variantId as PerformanceSessionInput['accompanimentVariant'],
    instrumentId: c.instrumentId,
    accompanimentEnergy: 'build',
    octaveShift: 0,
    releaseCut: false,
    instrumentEffect: c.effect,
    drumMode: DRUM_MODE,
    drumBeat: DRUM_BEAT,
    progression: PROG.chords,
  };
}

/** Every pattern × Type on piano with no effect: the generation-quality sweep. */
function typeCases(): Case[] {
  const cases: Case[] = [];
  for (const pattern of CORE_PATTERNS) {
    for (const variant of offeredVariantsFor(pattern)) {
      cases.push({
        label: `${pattern}-${variant.id.split('.')[1] ?? variant.id}`,
        pattern,
        variantId: variant.id,
        instrumentId: 'piano',
        effect: 'off',
      });
    }
  }
  return cases;
}

/** Instrument × effect on one Type: the timbre/effect sweep. */
function effectCases(): Case[] {
  const pattern: AccompanimentPattern = 'relaxed';
  const variantId = variantsFor(pattern)[0]!.id;
  const cases: Case[] = [];
  for (const instrumentId of ['piano', 'ePiano'] as InstrumentId[]) {
    for (const effect of ['off', 'sustain', 'releaseCut'] as InstrumentEffect[]) {
      cases.push({
        label: `${pattern}-${instrumentId}-${effect}`,
        pattern,
        variantId,
        instrumentId,
        effect,
      });
    }
  }
  return cases;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function num(n: number, digits = 1): string {
  return n.toFixed(digits);
}

function renderCase(c: Case): string[] {
  const plan = buildSessionPerformancePlan(sessionFor(c), TIER);
  const snapshot = buildFinalMidiSnapshot(plan);
  writeFileSync(join(OUT_DIR, `${c.label}.mid`), Buffer.from(writeSmf(snapshot)));

  const m = computeMetrics(plan.notes, plan.chords);
  const f = analyzePlaybackFidelity(plan.notes, plan.bpm);
  const chord = m.perTrack.chord;
  const bass = m.perTrack.bass;

  const lines = [
    `## ${c.label}`,
    '',
    `- template: ${plan.humanTemplateId ?? '(none)'}`,
    `- notes: ${m.totalNotes} (chord ${chord?.noteCount ?? 0}, top ${m.perTrack.top?.noteCount ?? 0}, bass ${bass?.noteCount ?? 0})`,
    `- max polyphony: ${m.maxPolyphony}`,
    `- non-chord tones: ${m.nonChordToneCount}`,
    `- velocity: mean ${num(chord?.velocityMean ?? 0)} sd ${num(chord?.velocityStdDev ?? 0)} — ${f.velocityLevels} distinct levels`,
    `- chord register: ${chord?.pitchMin ?? 0}–${chord?.pitchMax ?? 0}, bass ${bass?.pitchMin ?? 0}–${bass?.pitchMax ?? 0}`,
    `- timing deviation: mean ${num(chord?.timingDeviationMean ?? 0, 3)} max ${num(chord?.timingDeviationMax ?? 0, 3)} beats`,
    '',
    'playback reproduction (current native sampler):',
    `- notes cut by the ${SAMPLE_TAIL_SECONDS}s sample tail: ${f.tailTruncatedNotes} (longest note ${num(f.longestNoteSeconds, 2)}s)`,
    `- notes clamped into ${CAPTURED_PITCH_MIN}–${CAPTURED_PITCH_MAX}: ${f.clampedPitchNotes} (worst ${f.worstClampSemitones} semitones)`,
    `- unison collisions (same onset + pitch): ${f.unisonCollisions}`,
    `- notes past the voice cap: ${f.voiceCappedNotes}`,
    '',
  ];

  const summary =
    `${pad(c.label, 26)} notes ${pad(String(m.totalNotes), 5)} poly ${pad(String(m.maxPolyphony), 3)}` +
    ` velSd ${pad(num(chord?.velocityStdDev ?? 0), 5)} levels ${pad(String(f.velocityLevels), 3)}` +
    ` tailCut ${pad(String(f.tailTruncatedNotes), 4)} clamped ${pad(String(f.clampedPitchNotes), 4)}` +
    ` unison ${f.unisonCollisions}`;

  return [summary, lines.join('\n')];
}

describe('audition harness', () => {
  it('writes .mid files and a metrics report for DAW listening', () => {
    mkdirSync(OUT_DIR, { recursive: true });

    const cases = [...typeCases(), ...effectCases()];
    const summaries: string[] = [];
    const details: string[] = [];
    for (const c of cases) {
      const [summary, detail] = renderCase(c);
      summaries.push(summary!);
      details.push(detail!);
    }

    const header = [
      '# Audition report',
      '',
      `- progression: ${PROG.id} — ${PROG.name} (key ${PROG.key})`,
      `- bpm: ${BPM}`,
      `- drums: ${DRUM_MODE}${DRUM_MODE === 'off' ? '' : ` / ${DRUM_BEAT}Beat`}`,
      `- tier: ${TIER}`,
      `- cases: ${cases.length}`,
      '',
      '## Summary',
      '',
      '```',
      ...summaries,
      '```',
      '',
    ].join('\n');

    writeFileSync(join(OUT_DIR, 'report.md'), `${header}${details.join('\n')}`, 'utf8');
    // eslint-disable-next-line no-console
    console.log(`\n${header}${''}\nwrote ${cases.length} .mid files to ${OUT_DIR}\n`);

    expect(cases.length).toBeGreaterThan(0);
  });
});
