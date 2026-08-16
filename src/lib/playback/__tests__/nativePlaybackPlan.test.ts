/**
 * Objective validation of the realtime playback path (Phase 4).
 *
 * The claim under test is narrow and checkable without a device: what native receives
 * is the Final MIDI, event for event. Everything below the bridge (sampler, release,
 * stereo) needs ears; everything above it is provable here, so a pitch / velocity /
 * onset / duration / CC64 regression cannot reach a build unnoticed.
 *
 * The playback bytes are decoded with the same SMF parser the ingest pipeline uses, so
 * the test reads the file the way a third party would rather than trusting the writer.
 */

import { buildFinalMidiSnapshot, buildSessionPerformancePlan, writeSmf } from '@/lib/midiExport';
import { INSTRUMENT_EFFECT_IDS } from '@/lib/performance/effect';
import type { FinalMidiSnapshot } from '@/lib/performance/finalMidi/types';
import { parseSmf } from '@/lib/performance/library/ingest/smf';
import { CORE_PATTERNS } from '@/lib/performance/model/styleCards';
import { offeredVariantsFor, variantsFor } from '@/lib/performance/variants';
import {
  base64ToBytes,
  buildNativePlaybackPlan,
  snapshotSignature,
  snapshotToMidiEvents,
} from '@/lib/playback';
import {
  durationTestSnapshot,
  playbackTestSessionInput,
  polyphonyTestSnapshot,
  sustainTestSnapshot,
  velocityTestSnapshot,
} from '@/lib/playback/fixtures';
import { DEFAULT_PPQ } from '@/lib/midiExport/smfWrite';

const PPQ = DEFAULT_PPQ;

function fixedSnapshot(pattern = 'relaxed' as const, variantIndex = 0): FinalMidiSnapshot {
  const variant = variantsFor(pattern)[variantIndex]!;
  const plan = buildSessionPerformancePlan(playbackTestSessionInput(pattern, variant.id), 'pro');
  return buildFinalMidiSnapshot(plan);
}

/**
 * Both lists are ordered by the TICK a note lands on, not its exact beat: a file stores
 * onsets quantised to ticks, so two notes a millionth of a beat apart share a tick and
 * their order in the file is by pitch. Sorting the expectation the same way compares
 * musical content instead of float noise.
 */
function byTickThenPitch(
  a: { startBeat: number; pitch: number; velocity?: number },
  b: typeof a,
): number {
  return (
    Math.round(a.startBeat * PPQ) - Math.round(b.startBeat * PPQ) ||
    a.pitch - b.pitch ||
    (a.velocity ?? 0) - (b.velocity ?? 0)
  );
}

function noteKey(n: { startBeat: number; pitch: number; velocity: number }): string {
  return `${Math.round(n.startBeat * PPQ)}:${n.pitch}:${n.velocity}`;
}

/** Notes as native will schedule them, read back out of the bridge payload. */
function scheduledNotes(snapshot: FinalMidiSnapshot) {
  const plan = buildNativePlaybackPlan(snapshot);
  const song = parseSmf(base64ToBytes(plan.smfBase64));
  return song.notes
    .map((n) => ({
      pitch: n.pitch,
      velocity: n.velocity,
      startBeat: n.tick / PPQ,
      durationBeat: n.durTicks / PPQ,
      channel: n.channel,
    }))
    .sort(byTickThenPitch);
}

function expectedNotes(snapshot: FinalMidiSnapshot) {
  return snapshot.notes
    .map((n) => ({
      pitch: n.pitch,
      velocity: n.velocity,
      startBeat: n.startBeat,
      durationBeat: n.durationBeat,
      channel: n.channel,
    }))
    .sort(byTickThenPitch);
}

describe('native playback plan — Final MIDI equivalence', () => {
  it('schedules every pitch and velocity exactly as the snapshot says', () => {
    const snapshot = fixedSnapshot();
    const scheduled = scheduledNotes(snapshot);
    const expected = expectedNotes(snapshot);

    expect(scheduled.length).toBe(expected.length);
    expect(scheduled.map((n) => n.pitch)).toEqual(expected.map((n) => n.pitch));
    expect(scheduled.map((n) => n.velocity)).toEqual(expected.map((n) => n.velocity));
  });

  it('schedules onsets and note-offs at the snapshot times (tick resolution)', () => {
    const snapshot = fixedSnapshot();
    const scheduled = scheduledNotes(snapshot);
    const expected = expectedNotes(snapshot);
    const tick = 1 / PPQ;

    scheduled.forEach((note, i) => {
      const want = expected[i]!;
      expect(Math.abs(note.startBeat - want.startBeat)).toBeLessThanOrEqual(tick);
      expect(note.durationBeat).toBeGreaterThan(0);
    });
    // Durations are compared only where the pitch is not overlapped — SMF
    // note-off pairing is FIFO and cannot recover two stacked same-pitch notes.
    const isolated = expected.filter(
      (n) =>
        expected.filter(
          (o) =>
            o.pitch === n.pitch &&
            o.startBeat < n.startBeat + n.durationBeat &&
            o.startBeat + o.durationBeat > n.startBeat,
        ).length === 1,
    );
    isolated.forEach((want) => {
      const got = scheduled.find(
        (n) =>
          n.pitch === want.pitch &&
          Math.abs(n.startBeat - want.startBeat) <= tick,
      );
      expect(got).toBeDefined();
      expect(Math.abs(got!.durationBeat - want.durationBeat)).toBeLessThanOrEqual(tick * 2);
    });
  });

  it('carries CC64 to native with the same value and timing', () => {
    const snapshot = sustainTestSnapshot();
    const plan = buildNativePlaybackPlan(snapshot);
    const song = parseSmf(base64ToBytes(plan.smfBase64));
    const pedal = song.controlChanges.filter((c) => c.controller === 64);

    expect(pedal.length).toBe(snapshot.controlChanges.length);
    expect(plan.controlChangeCount).toBe(snapshot.controlChanges.length);
    snapshot.controlChanges.forEach((want, i) => {
      const got = pedal[i]!;
      expect(got.value).toBe(want.value);
      expect(got.tick / PPQ).toBeCloseTo(want.startBeat, 5);
    });
  });

  it('keeps tempo and time signature so native never guesses the clock', () => {
    const snapshot = fixedSnapshot();
    const plan = buildNativePlaybackPlan(snapshot);
    const song = parseSmf(base64ToBytes(plan.smfBase64));

    expect(60_000_000 / song.tempos[0]!.usPerQuarter).toBeCloseTo(snapshot.bpm, 1);
    expect(song.timeSignatures[0]).toMatchObject(snapshot.timeSignature);
    expect(plan.bpm).toBe(snapshot.bpm);
    expect(plan.ppq).toBe(PPQ);
  });

  it('omits the program change for playback but keeps it for export', () => {
    const snapshot = fixedSnapshot();
    const playback = base64ToBytes(buildNativePlaybackPlan(snapshot).smfBase64);
    const exported = writeSmf(snapshot);

    // 0xC0 = program change on channel 0. Native loads the SoundFont program itself;
    // a program change would select a preset that was never loaded.
    expect(playback.includes(0xc0)).toBe(false);
    expect(exported.includes(0xc0)).toBe(true);
  });

  it('tells native the instrument program instead of leaving it to be inferred', () => {
    const piano = fixedSnapshot();
    expect(buildNativePlaybackPlan(piano).gmProgram).toBe(0);

    const ePiano: FinalMidiSnapshot = { ...piano, instrumentId: 'ePiano', gmProgram: 4 };
    const plan = buildNativePlaybackPlan(ePiano);
    expect(plan.gmProgram).toBe(4);
    expect(plan.instrument).toBe('ePiano');
  });

  it('flags drum presence so the piano is never routed to the percussion bank', () => {
    const noDrums = fixedSnapshot();
    expect(buildNativePlaybackPlan(noDrums).hasDrums).toBe(false);

    const withDrums: FinalMidiSnapshot = {
      ...noDrums,
      drumMode: 'full',
      notes: [
        ...noDrums.notes,
        { startBeat: 0, durationBeat: 0.25, pitch: 36, velocity: 100, channel: 9, track: 'drums' },
      ],
    };
    const plan = buildNativePlaybackPlan(withDrums);
    expect(plan.hasDrums).toBe(true);
    const song = parseSmf(base64ToBytes(plan.smfBase64));
    expect(song.notes.some((n) => n.channel === 9 && n.pitch === 36)).toBe(true);
  });

  it('reports event counts that match the snapshot', () => {
    const snapshot = fixedSnapshot();
    const plan = buildNativePlaybackPlan(snapshot);
    const song = parseSmf(base64ToBytes(plan.smfBase64));

    expect(plan.noteOnCount).toBe(snapshot.notes.length);
    expect(song.notes.length).toBe(snapshot.notes.length);
  });

  it('round-trips the base64 payload byte for byte', () => {
    const snapshot = fixedSnapshot();
    const plan = buildNativePlaybackPlan(snapshot);
    const decoded = base64ToBytes(plan.smfBase64);
    const direct = writeSmf(snapshot, PPQ, { includeProgramChange: false });

    expect(decoded.length).toBe(direct.length);
    expect(Array.from(decoded)).toEqual(Array.from(direct));
  });

  it('keeps loop and seek as native transport inputs, not JS timing', () => {
    const snapshot = fixedSnapshot();
    const plan = buildNativePlaybackPlan(snapshot, { loop: true, startBeat: 6.5 });
    expect(plan.loop).toBe(true);
    expect(plan.startBeat).toBe(6.5);
    expect(plan.totalBeats).toBe(snapshot.totalBeats);

    // A negative seek must never become a negative sequencer position.
    expect(buildNativePlaybackPlan(snapshot, { startBeat: -4 }).startBeat).toBe(0);
  });

  it('signs the plan so an A/B can prove both engines got the same Final MIDI', () => {
    const snapshot = fixedSnapshot();
    expect(buildNativePlaybackPlan(snapshot).signature).toBe(snapshotSignature(snapshot));
    // Same input → same signature (the engines are compared, not the material).
    expect(snapshotSignature(fixedSnapshot())).toBe(snapshotSignature(fixedSnapshot()));
    // One changed velocity → different signature.
    const nudged: FinalMidiSnapshot = {
      ...snapshot,
      notes: snapshot.notes.map((n, i) => (i === 0 ? { ...n, velocity: n.velocity + 1 } : n)),
    };
    expect(snapshotSignature(nudged)).not.toBe(snapshotSignature(snapshot));
  });

  it('holds for every pattern, Type and effect the UI can select', () => {
    for (const pattern of CORE_PATTERNS) {
      for (const variant of offeredVariantsFor(pattern)) {
        for (const instrumentEffect of INSTRUMENT_EFFECT_IDS) {
          const plan = buildSessionPerformancePlan(
            {
              ...playbackTestSessionInput(pattern, variant.id),
              instrumentEffect,
              drumMode: 'full',
            },
            'pro',
          );
          const snapshot = buildFinalMidiSnapshot(plan);
          const scheduled = scheduledNotes(snapshot);
          const expected = expectedNotes(snapshot);

          expect(scheduled.length).toBe(expected.length);
          expect(scheduled.map(noteKey).sort()).toEqual(expected.map(noteKey).sort());
          expect(scheduled.every((n) => n.durationBeat > 0)).toBe(true);
        }
      }
    }
  });

  it('flattens the snapshot into the MIDI messages native will send', () => {
    const snapshot = sustainTestSnapshot();
    const events = snapshotToMidiEvents(snapshot);
    const ons = events.filter((e) => e.kind === 'on');
    const offs = events.filter((e) => e.kind === 'off');
    const ccs = events.filter((e) => e.kind === 'cc');

    expect(ons.length).toBe(snapshot.notes.length);
    expect(offs.length).toBe(snapshot.notes.length);
    expect(ccs.length).toBe(snapshot.controlChanges.length);
    expect(ons.map((e) => [e.a, e.b])).toEqual(snapshot.notes.map((n) => [n.pitch, n.velocity]));
    expect(ccs.map((e) => [e.a, e.b])).toEqual(
      snapshot.controlChanges.map((c) => [c.controller, c.value]),
    );
    // Pedal-down must be scheduled at or before the notes it sustains.
    const firstOn = ons[0]!.beat;
    expect(ccs[0]!.beat).toBeLessThanOrEqual(firstOn);
  });

  it('handles the synthetic audio tests without dropping or reordering events', () => {
    for (const snapshot of [
      velocityTestSnapshot(),
      durationTestSnapshot(),
      sustainTestSnapshot(),
      polyphonyTestSnapshot(),
    ]) {
      const scheduled = scheduledNotes(snapshot);
      const expected = expectedNotes(snapshot);
      expect(scheduled.map((n) => [n.pitch, n.velocity])).toEqual(
        expected.map((n) => [n.pitch, n.velocity]),
      );
    }
  });
});
