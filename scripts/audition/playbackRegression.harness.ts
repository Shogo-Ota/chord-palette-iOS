/**
 * Fixed playback artifacts (Phase 0 + Phase 5 of the playback rebuild).
 *
 * Freezes the Final MIDI used for every OLD-vs-NEW comparison. Once these files exist,
 * an A/B is a comparison of ENGINES: the same bytes, the same signature, the only
 * variable being which engine plays them. Regenerating them after a generation-layer
 * change will alter the signatures — which is the point, and the manifest makes it
 * visible instead of silent.
 *
 * Writes to `LocalAnalysis/playback_regression/` (git-ignored):
 *   block_type1.mid / ballad_type1.mid / arpeggio_type1.mid  — the musical set
 *   velocity_test.mid / duration_test.mid / sustain_test.mid / polyphony_test.mid
 *   manifest.json  — signature, event counts and playback-limit findings per artifact
 *
 * Fixed conditions: C | Am | Fmaj7 | G7, piano, drums off, effect off, 90 BPM, Type 1.
 *
 * Run: `npm run audition:playback`. Not part of the test suite (`.harness.ts` is
 * outside the default `testMatch`).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  buildFinalMidiSnapshot,
  buildSessionPerformancePlan,
  validateFinalMidiSnapshot,
  writeSmf,
  type PerformanceSessionInput,
} from '@/lib/midiExport';
import { computeMetrics } from '@/lib/performance/analysis/metrics';
import { analyzePlaybackFidelity } from '@/lib/performance/analysis/playbackFidelity';
import type { FinalMidiSnapshot } from '@/lib/performance/finalMidi/types';
import { variantsFor } from '@/lib/performance/variants';
import { buildNativePlaybackPlan } from '@/lib/playback';
import {
  durationTestSnapshot,
  PLAYBACK_TEST_BPM,
  PLAYBACK_TEST_PROGRESSION,
  playbackTestSessionInput,
  polyphonyTestSnapshot,
  sustainTestSnapshot,
  velocityTestSnapshot,
} from '@/lib/playback/fixtures';
import type { AccompanimentPattern } from '@/types';

const OUT_DIR = resolve(process.env.PLAYBACK_ARTIFACT_DIR ?? 'LocalAnalysis/playback_regression');

interface ManifestEntry {
  file: string;
  kind: 'musical' | 'synthetic';
  bpm: number;
  totalBeats: number;
  noteCount: number;
  controlChangeCount: number;
  /** Fingerprint of the Final MIDI — must match what native reports for the take. */
  signature: string;
  exportBytes: number;
  playbackBytes: number;
  valid?: boolean;
  validationErrors?: string[];
  metrics?: {
    maxPolyphony: number;
    nonChordTones: number;
    velocityLevels: number;
    /** Notes v1 cannot hold to the end (3 s captured tail). */
    tailTruncatedNotes: number;
    /** Notes v1 sounds at the wrong pitch (clamped into 24–84). */
    clampedPitchNotes: number;
    unisonCollisions: number;
    longestNoteSeconds: number;
  };
}

function writeArtifact(
  file: string,
  snapshot: FinalMidiSnapshot,
  kind: ManifestEntry['kind'],
): ManifestEntry {
  // The .mid on disk is the EXPORT encoding (with its GM program change) so it plays in
  // a DAW as the reference. The playback encoding is measured but not written: native
  // gets it in the play request, and it differs only by that one event.
  const exportBytes = writeSmf(snapshot);
  const playback = buildNativePlaybackPlan(snapshot, { loop: false });
  writeFileSync(join(OUT_DIR, file), Buffer.from(exportBytes));

  return {
    file,
    kind,
    bpm: snapshot.bpm,
    totalBeats: snapshot.totalBeats,
    noteCount: snapshot.notes.length,
    controlChangeCount: snapshot.controlChanges.length,
    signature: playback.signature,
    exportBytes: exportBytes.length,
    playbackBytes: Math.floor((playback.smfBase64.length * 3) / 4),
  };
}

const PATTERNS: { pattern: AccompanimentPattern; file: string }[] = [
  { pattern: 'block', file: 'block_type1.mid' },
  { pattern: 'relaxed', file: 'ballad_type1.mid' },
  { pattern: 'arpeggio', file: 'arpeggio_type1.mid' },
];

describe('playback regression artifacts', () => {
  it('freezes the fixed Final MIDI set for OLD vs NEW comparison', () => {
    mkdirSync(OUT_DIR, { recursive: true });
    const manifest: ManifestEntry[] = [];

    for (const { pattern, file } of PATTERNS) {
      const variant = variantsFor(pattern)[0]!;
      const session: PerformanceSessionInput = playbackTestSessionInput(pattern, variant.id);
      const plan = buildSessionPerformancePlan(session, 'pro');
      const snapshot = buildFinalMidiSnapshot(plan);
      const entry = writeArtifact(file, snapshot, 'musical');

      const validation = validateFinalMidiSnapshot(snapshot, plan);
      const m = computeMetrics(plan.notes, plan.chords);
      const f = analyzePlaybackFidelity(plan.notes, plan.bpm);
      entry.valid = validation.ok;
      if (!validation.ok) entry.validationErrors = validation.errors;
      entry.metrics = {
        maxPolyphony: m.maxPolyphony,
        nonChordTones: m.nonChordToneCount,
        velocityLevels: f.velocityLevels,
        tailTruncatedNotes: f.tailTruncatedNotes,
        clampedPitchNotes: f.clampedPitchNotes,
        unisonCollisions: f.unisonCollisions,
        longestNoteSeconds: Number(f.longestNoteSeconds.toFixed(3)),
      };
      manifest.push(entry);
    }

    manifest.push(writeArtifact('velocity_test.mid', velocityTestSnapshot(), 'synthetic'));
    manifest.push(writeArtifact('duration_test.mid', durationTestSnapshot(), 'synthetic'));
    manifest.push(writeArtifact('sustain_test.mid', sustainTestSnapshot(), 'synthetic'));
    manifest.push(writeArtifact('polyphony_test.mid', polyphonyTestSnapshot(), 'synthetic'));

    const doc = {
      generatedFor: 'playback engine A/B (v1 sampled vs v2 realtime sampler)',
      progression: PLAYBACK_TEST_PROGRESSION.map((c) => c.displayName).join(' | '),
      bpm: PLAYBACK_TEST_BPM,
      conditions: 'piano / drums off / effect off / Type 1 / tier pro',
      artifacts: manifest,
    };
    writeFileSync(join(OUT_DIR, 'manifest.json'), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');

    // eslint-disable-next-line no-console
    console.log(
      `\nwrote ${manifest.length} artifacts to ${OUT_DIR}\n` +
        manifest
          .map((e) => `  ${e.file.padEnd(20)} sig=${e.signature} notes=${e.noteCount}`)
          .join('\n') +
        '\n',
    );

    expect(manifest.every((e) => e.noteCount > 0)).toBe(true);
  });
});
