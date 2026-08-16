import { EVAL_PROGRESSIONS } from '@/lib/performance/analysis/fixtures';
import {
  assertExportValid,
  buildFinalMidiSnapshot,
  buildSessionPerformancePlan,
  validateFinalMidiSnapshot,
  validateSmfBytes,
  writeSmf,
} from '@/lib/midiExport';
import type { PerformanceSessionInput } from '@/lib/midiExport';
import { INSTRUMENT_EFFECT_IDS } from '@/lib/performance/effect';
import { playbackAccompanimentNotes } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import { parseSmf } from '@/lib/performance/library/ingest/smf';
import { CORE_PATTERNS } from '@/lib/performance/model/styleCards';
import { offeredVariantsFor } from '@/lib/performance/variants';
import { mapPerfNotesToPlaybackRequest } from '@/services/audio/performanceMapper';

const PROG = EVAL_PROGRESSIONS[1]!;

function sessionInput(): PerformanceSessionInput {
  return {
    key: PROG.key,
    tempoBpm: PROG.bpm,
    grooveId: 'pop8',
    accompanimentPattern: 'natural',
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift: 0,
    releaseCut: false,
    instrumentEffect: 'sustain',
    drumMode: 'full',
    progression: PROG.chords,
  };
}

describe('MIDI export pipeline', () => {
  it('export accompaniment note count matches playback chordEvents', () => {
    const plan = buildSessionPerformancePlan(sessionInput(), 'free');
    const snapshot = buildFinalMidiSnapshot(plan);
    const playback = mapPerfNotesToPlaybackRequest(plan.notes, {
      bpm: plan.bpm,
      totalBeats: plan.totalBeats,
      loop: false,
      drumPatternId: plan.drumPatternId,
      instrument: plan.instrumentId,
      beatsPerBar: plan.beatsPerBar,
      drumMode: plan.drumMode,
    });

    const exportAccomp = snapshot.notes.filter((n) => n.track === 'accompaniment');
    expect(exportAccomp.length).toBe(playback.chordEvents.length);
    assertExportValid(snapshot, plan);
  });

  it('writes parseable Format 1 SMF with tempo and markers', () => {
    const plan = buildSessionPerformancePlan(sessionInput(), 'free');
    const snapshot = buildFinalMidiSnapshot(plan);
    const bytes = writeSmf(snapshot);
    const song = parseSmf(bytes);

    expect(song.format).toBe(1);
    expect(song.ppq).toBe(480);
    expect(song.tempos.length).toBeGreaterThan(0);
    expect(song.timeSignatures.length).toBeGreaterThan(0);
    expect(song.notes.length).toBeGreaterThan(0);
    expect(snapshot.markers.length).toBe(PROG.chords.length);
  });

  it('respects drumMode off — no drum notes in snapshot', () => {
    const plan = buildSessionPerformancePlan({ ...sessionInput(), drumMode: 'off' }, 'free');
    const snapshot = buildFinalMidiSnapshot(plan);
    expect(snapshot.notes.every((n) => n.track === 'accompaniment')).toBe(true);
    const v = validateFinalMidiSnapshot(snapshot, plan);
    expect(v.ok).toBe(true);
  });

  it('clap mode exports clap GM notes only', () => {
    const plan = buildSessionPerformancePlan({ ...sessionInput(), drumMode: 'clap' }, 'free');
    const snapshot = buildFinalMidiSnapshot(plan);
    const drums = snapshot.notes.filter((n) => n.track === 'drums');
    expect(drums.length).toBeGreaterThan(0);
    expect(drums.every((n) => n.pitch === 39)).toBe(true);
    expect(validateSmfBytes(snapshot).ok).toBe(true);
  });

  it('exports what the app played — every Type, effect and drum reading', () => {
    for (const pattern of CORE_PATTERNS) {
      for (const variant of offeredVariantsFor(pattern)) {
        for (const instrumentEffect of INSTRUMENT_EFFECT_IDS) {
          for (const drumMode of ['off', 'clap', 'full'] as const) {
            const plan = buildSessionPerformancePlan(
              {
                ...sessionInput(),
                accompanimentPattern: pattern,
                accompanimentVariant: variant.id,
                instrumentEffect,
                drumMode,
                drumBeat: '16',
              },
              'pro',
            );
            const snapshot = buildFinalMidiSnapshot(plan);
            // The written file is the plan the engine handed to playback, note for note.
            assertExportValid(snapshot, plan);
            expect(validateSmfBytes(snapshot).ok).toBe(true);
            const accomp = snapshot.notes.filter((n) => n.track === 'accompaniment');
            expect(accomp.length).toBe(playbackAccompanimentNotes(plan).length);
          }
        }
      }
    }
  });

  it('carries tempo, time signature, CC64 and chord markers', () => {
    const plan = buildSessionPerformancePlan(
      { ...sessionInput(), accompanimentPattern: 'relaxed' },
      'pro',
    );
    const snapshot = buildFinalMidiSnapshot(plan);
    const song = parseSmf(writeSmf(snapshot));
    expect(60_000_000 / song.tempos[0]!.usPerQuarter).toBeCloseTo(plan.bpm, 1);
    expect(song.timeSignatures[0]).toMatchObject({ numerator: 4, denominator: 4 });
    expect(snapshot.controlChanges.some((c) => c.controller === 64)).toBe(true);
    expect(snapshot.markers.map((m) => m.label)).toEqual(
      plan.progression.map((c) => c.displayName),
    );
    for (const note of song.notes) {
      expect(note.velocity).toBeGreaterThan(0);
      expect(note.durTicks).toBeGreaterThan(0);
    }
  });

  it('rejects illegal pitch in validation', () => {
    const plan = buildSessionPerformancePlan(sessionInput(), 'free');
    const snapshot = buildFinalMidiSnapshot(plan);
    snapshot.notes[0]!.pitch = 0;
    const v = validateFinalMidiSnapshot(snapshot, plan);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes('illegal pitch'))).toBe(true);
  });
});
