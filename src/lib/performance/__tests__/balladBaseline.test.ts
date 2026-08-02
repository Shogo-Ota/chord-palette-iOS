/**
 * Ballad Baseline generator tests + optional golden-file writer.
 *
 * Write / refresh the pinned baseline:
 *   BALLAD_BASELINE_WRITE=1 npx jest balladBaseline
 *
 * Policy: the pinned `*_v1.json` is the formal baseline. Normal CI does not
 * overwrite it; regenerate only when intentionally accepting a new engine
 * snapshot (and then bump to v2 if the change is a new contract).
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  BALLAD_BASELINE_PINNED_PATH,
  BALLAD_BASELINE_SEED,
  baselineFingerprint,
  buildBalladBaseline,
} from '@/lib/performance/analysis/balladBaseline';

describe('Ballad Baseline (C-G-Am-F / 90 / relaxed)', () => {
  const fixedNow = () => '2026-08-03T00:00:00.000Z';
  const baseline = buildBalladBaseline(fixedNow);

  it('uses the approved fixed conditions', () => {
    expect(baseline.conditions.progression).toBe('C - G - Am - F');
    expect(baseline.conditions.bpm).toBe(90);
    expect(baseline.conditions.timeSignature).toEqual({ beatsPerBar: 4, beatUnit: 4 });
    expect(baseline.conditions.style).toBe('ballad');
    expect(baseline.conditions.pattern).toBe('relaxed');
    expect(baseline.conditions.instrument).toBe('piano');
    expect(baseline.conditions.seed).toBe(BALLAD_BASELINE_SEED);
    expect(baseline.conditions.engineVersion.length).toBeGreaterThan(0);
    expect(baseline.conditions.generatedAt).toBe(fixedNow());
  });

  it('emits a non-empty event list within MIDI ranges', () => {
    expect(baseline.events.length).toBeGreaterThan(0);
    for (const e of baseline.events) {
      expect(e.startBeat).toBeGreaterThanOrEqual(0);
      expect(e.durationBeats).toBeGreaterThan(0);
      expect(e.noteNumber).toBeGreaterThanOrEqual(0);
      expect(e.noteNumber).toBeLessThanOrEqual(127);
      expect(e.velocity).toBeGreaterThanOrEqual(1);
      expect(e.velocity).toBeLessThanOrEqual(127);
      expect(e.barIndex).toBeGreaterThanOrEqual(0);
      expect(e.beatPosition).toBeGreaterThanOrEqual(0);
      expect(e.beatPosition).toBeLessThan(4 + 1e-6);
    }
  });

  it('is fully deterministic for the same seed and clock stub', () => {
    expect(baselineFingerprint(buildBalladBaseline(fixedNow))).toBe(
      baselineFingerprint(baseline),
    );
  });

  it('reports zero integrity errors on the production Ballad path', () => {
    expect(baseline.integrity.errorCount).toBe(0);
    expect(baseline.integrity.negativeStartTimeCount).toBe(0);
    expect(baseline.integrity.nonPositiveDurationCount).toBe(0);
    expect(baseline.integrity.pitchOutOfRangeCount).toBe(0);
    expect(baseline.integrity.velocityOutOfRangeCount).toBe(0);
    expect(baseline.integrity.noteOnOffInconsistencyCount).toBe(0);
    expect(baseline.integrity.duplicateEventCount).toBe(0);
  });

  it('includes chord (piano-family) events under the Ballad pattern', () => {
    const chordish = baseline.events.filter((e) => e.part === 'chord' || e.part === 'top');
    expect(chordish.length).toBeGreaterThan(0);
    expect(baseline.partStats.chord?.noteCount ?? 0).toBeGreaterThan(0);
  });

  it('writes or matches the pinned golden baseline JSON', () => {
    const abs = path.resolve(process.cwd(), BALLAD_BASELINE_PINNED_PATH);
    if (process.env.BALLAD_BASELINE_WRITE === '1') {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, JSON.stringify(baseline, null, 2) + '\n');
    }
    expect(fs.existsSync(abs)).toBe(true);
    const pinned = JSON.parse(fs.readFileSync(abs, 'utf8')) as ReturnType<
      typeof buildBalladBaseline
    >;
    expect(baselineFingerprint(pinned)).toBe(baselineFingerprint(baseline));
    expect(pinned.conditions.bpm).toBe(90);
    expect(pinned.conditions.pattern).toBe('relaxed');
    expect(pinned.conditions.progression).toBe('C - G - Am - F');
  });
});
