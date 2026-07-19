import { computeGate } from '@/lib/performance/articulation';
import type { NoteEvent, TrackId } from '@/lib/performance/NoteEvent';
import {
  generatePerformance,
  type PerfChord,
  type PerformanceInput,
} from '@/lib/performance/PerformanceEngine';
import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import { RoundRobinPicker, registerBand, velocityLayer } from '@/lib/performance/roundRobin';
import { EIGHT_BEAT } from '@/lib/performance/styles/eightBeat';
import { STYLE_IDS } from '@/lib/performance/styles';
import { PRESETS } from '@/data/presets';
import { buildPresetProgression } from '@/lib/presets';
import type { ChordEvent, MajorKey } from '@/types';

/* ------------------------------------------------------------------ */
/* Fixtures: a plain 4-chord × 4-beat progression (16 beats = 4 bars). */
/* Chord bodies are simple mid-band triads; bass is anchored C1+C2.    */
/* ------------------------------------------------------------------ */
function chord(body: number[], bass: number[], startBeat: number): PerfChord {
  return { bodyMidi: body, bassMidi: bass, startBeat, durationBeats: 4 };
}

const PROGRESSION: PerfChord[] = [
  chord([48, 52, 55], [24, 36], 0), // C
  chord([55, 59, 62], [31, 43], 4), // G
  chord([57, 60, 64], [33, 45], 8), // Am
  chord([53, 57, 60], [29, 41], 12), // F
];

const INPUT: PerformanceInput = { chords: PROGRESSION, bpm: 110, seed: 20260719 };

function eventsOf(track: TrackId, events: NoteEvent[]): NoteEvent[] {
  return events
    .filter((e) => e.trackId === track)
    .sort((a, b) => a.timeBeat - b.timeBeat || a.pitch - b.pitch);
}

/* ------------------------------------------------------------------ */
/* Determinism (design §1 / §6: same seed ⇒ same performance)          */
/* ------------------------------------------------------------------ */
describe('PerformanceEngine — determinism', () => {
  it('same input yields byte-identical NoteEvent[]', () => {
    const a = generatePerformance(INPUT, { styleId: 'eightBeat' });
    const b = generatePerformance(INPUT, { styleId: 'eightBeat' });
    expect(a).toEqual(b);
  });

  it('different seeds differ but keep the same structure (count/pitches)', () => {
    const a = generatePerformance({ ...INPUT, seed: 1 }, { styleId: 'eightBeat' });
    const b = generatePerformance({ ...INPUT, seed: 2 }, { styleId: 'eightBeat' });
    expect(a).not.toEqual(b);
    expect(a).toHaveLength(b.length);
    // Same notes are played (multiset of pitches); only the humanized timing/velocity
    // differs, so compare sorted pitches rather than order (microtiming can reorder ties).
    const sortedPitches = (events: NoteEvent[]) => events.map((e) => e.pitch).sort((x, y) => x - y);
    expect(sortedPitches(a)).toEqual(sortedPitches(b));
  });

  it('every event carries the project seed', () => {
    const events = generatePerformance(INPUT, { styleId: 'eightBeat' });
    expect(events.every((e) => e.seed === INPUT.seed)).toBe(true);
  });

  it('returns [] for an empty progression', () => {
    expect(generatePerformance({ ...INPUT, chords: [] }, { styleId: 'eightBeat' })).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Velocity: no 5 identical velocities in a row (per track)            */
/* ------------------------------------------------------------------ */
describe('PerformanceEngine — velocity', () => {
  const events = generatePerformance(INPUT, { styleId: 'sixteenBeat' });

  it('velocities are valid MIDI (1..127)', () => {
    expect(events.every((e) => e.velocity >= 1 && e.velocity <= 127)).toBe(true);
  });

  it('no track ever plays 5 identical velocities in a row', () => {
    for (const track of ['chord', 'bass', 'kick', 'snare', 'hat'] as TrackId[]) {
      const vels = eventsOf(track, events).map((e) => e.velocity);
      let run = 1;
      for (let i = 1; i < vels.length; i++) {
        run = vels[i] === vels[i - 1] ? run + 1 : 1;
        expect(run).toBeLessThan(5);
      }
    }
  });

  it('ghost notes are quiet (≤ 45) and marked as ghost articulation', () => {
    const ghosts = events.filter((e) => e.articulation === 'ghost');
    expect(ghosts.length).toBeGreaterThan(0);
    expect(ghosts.every((e) => e.velocity <= 45)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Microtiming: bar-boundary drift = 0 (through the engine)            */
/* ------------------------------------------------------------------ */
describe('PerformanceEngine — bar-boundary drift = 0', () => {
  const events = generatePerformance(INPUT, { styleId: 'eightBeat' });

  it('a downbeat note lands exactly on each integer bar start (no drift)', () => {
    for (const barStart of [0, 4, 8, 12]) {
      const onDownbeat = events.filter((e) => Math.abs(e.timeBeat - barStart) < 1e-9);
      expect(onDownbeat.length).toBeGreaterThan(0);
      // Exact — not 4.0001; offsets never accumulate across bars.
      onDownbeat.forEach((e) => expect(e.timeBeat).toBe(barStart));
    }
  });
});

/* ------------------------------------------------------------------ */
/* Duration / gate: 0.72–0.95 and a re-strike gap                      */
/* ------------------------------------------------------------------ */
describe('computeGate — stays within [0.72, 0.95]', () => {
  it('is always inside the style gate range across tempos and seeds', () => {
    const rngLike = (seq: number[]) => {
      let i = 0;
      return {
        next: () => seq[i++ % seq.length],
        range(min: number, max: number) {
          return min + this.next() * (max - min);
        },
        int: () => 0,
        bool: () => false,
        pick: <T>(a: readonly T[]) => a[0],
      };
    };
    for (const bpm of [70, 110, 160]) {
      for (const stepBeats of [0.25, 0.5, 1]) {
        const nominalMs = stepBeats * (60 / bpm) * 1000;
        for (const draw of [0, 0.25, 0.5, 0.75, 0.999]) {
          const gate = computeGate(rngLike([draw]), EIGHT_BEAT, nominalMs);
          expect(gate).toBeGreaterThanOrEqual(EIGHT_BEAT.gate.min - 1e-9);
          expect(gate).toBeLessThanOrEqual(EIGHT_BEAT.gate.max + 1e-9);
        }
      }
    }
  });
});

describe('PerformanceEngine — chord gate range & re-strike gap', () => {
  const events = generatePerformance(INPUT, { styleId: 'eightBeat' });
  const chordEvents = eventsOf('chord', events);

  it('chord notes have gate in [0.72, 0.95] (nominal = 1 beat here)', () => {
    // eightBeat comps on the quarter notes ⇒ nominal length is exactly 1 beat.
    chordEvents.forEach((e) => {
      expect(e.durationBeat).toBeGreaterThanOrEqual(0.72 - 1e-6);
      expect(e.durationBeat).toBeLessThanOrEqual(0.95 + 1e-6);
    });
  });

  it('leaves a gap before the same pitch is re-struck (≥ 15ms)', () => {
    const secPerBeat = 60 / INPUT.bpm;
    const byPitch = new Map<number, NoteEvent[]>();
    for (const e of chordEvents) {
      byPitch.set(e.pitch, [...(byPitch.get(e.pitch) ?? []), e]);
    }
    for (const list of byPitch.values()) {
      list.sort((a, b) => a.timeBeat - b.timeBeat);
      for (let i = 1; i < list.length; i++) {
        const gapMs = (list[i].timeBeat - (list[i - 1].timeBeat + list[i - 1].durationBeat)) * secPerBeat * 1000;
        expect(gapMs).toBeGreaterThanOrEqual(15 - 1e-6);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* Round Robin: ≥3 variants, no immediate repeat within a pool         */
/* ------------------------------------------------------------------ */
describe('RoundRobinPicker — ≥3 variants, no consecutive repeat', () => {
  it('never repeats the same index twice in a row within a pool', () => {
    const picker = new RoundRobinPicker(555, 4);
    let prev = -1;
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const idx = picker.next('hat', 42, 70); // one fixed pool
      expect(idx).not.toBe(prev);
      seen.add(idx);
      prev = idx;
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('is deterministic for the same seed', () => {
    const seq = (seed: number) => {
      const p = new RoundRobinPicker(seed, 4);
      return Array.from({ length: 20 }, () => p.next('chord', 60, 90));
    };
    expect(seq(1)).toEqual(seq(1));
  });

  it('classifies register bands and velocity layers', () => {
    expect(registerBand(48)).toBe(4);
    expect(velocityLayer(30)).toBe(0);
    expect(velocityLayer(70)).toBe(1);
    expect(velocityLayer(110)).toBe(2);
  });
});

describe('PerformanceEngine — round robin across the performance', () => {
  const events = generatePerformance(INPUT, { styleId: 'sixteenBeat' });
  it('uses at least 3 distinct round-robin indices', () => {
    expect(new Set(events.map((e) => e.rrIndex)).size).toBeGreaterThanOrEqual(3);
  });
});

/* ------------------------------------------------------------------ */
/* Representative progressions × every style stay well-formed          */
/* ------------------------------------------------------------------ */
describe('PerformanceEngine — representative presets × styles', () => {
  const KEYS: MajorKey[] = ['C', 'F', 'A♭'];

  for (const preset of PRESETS) {
    for (const styleId of STYLE_IDS) {
      it(`${preset.id} / ${styleId}: produces sorted, valid events in every key`, () => {
        for (const key of KEYS) {
          const progression: ChordEvent[] = buildPresetProgression(preset, key).map((e, i) => ({
            ...e,
            id: `e-${i}`,
          }));
          const events = generatePerformance(
            { chords: progressionToPerfChords(progression, key), bpm: 110, seed: 42 },
            { styleId },
          );
          expect(events.length).toBeGreaterThan(0);
          // Sorted by time, valid velocity, positive duration.
          for (let i = 1; i < events.length; i++) {
            expect(events[i].timeBeat).toBeGreaterThanOrEqual(events[i - 1].timeBeat - 1e-9);
          }
          expect(events.every((e) => e.velocity >= 1 && e.velocity <= 127)).toBe(true);
          expect(events.every((e) => e.durationBeat > 0)).toBe(true);
          // No 5 identical velocities in a row on the busy chord track.
          const chordVels = eventsOf('chord', events).map((e) => e.velocity);
          let run = 1;
          for (let i = 1; i < chordVels.length; i++) {
            run = chordVels[i] === chordVels[i - 1] ? run + 1 : 1;
            expect(run).toBeLessThan(5);
          }
        }
      });
    }
  }
});

/* ------------------------------------------------------------------ */
/* Demo output — concrete values for the music-supervisor review       */
/* ------------------------------------------------------------------ */
describe('PerformanceEngine — demo (jpop-royal 4536, C, 8-Beat)', () => {
  it('prints a few chord/bass events with velocity/timing/articulation', () => {
    const royal = PRESETS.find((p) => p.id === 'jpop-royal')!;
    const progression: ChordEvent[] = buildPresetProgression(royal, 'C').map((e, i) => ({
      ...e,
      id: `e-${i}`,
    }));
    const events = generatePerformance(
      { chords: progressionToPerfChords(progression, 'C'), bpm: 100, seed: 777 },
      { styleId: 'eightBeat' },
    );
    const sample = events
      .filter((e) => e.trackId === 'chord' || e.trackId === 'bass')
      .slice(0, 8)
      .map((e) => ({
        track: e.trackId,
        pitch: e.pitch,
        timeBeat: Number(e.timeBeat.toFixed(4)),
        durationBeat: Number(e.durationBeat.toFixed(4)),
        velocity: e.velocity,
        articulation: e.articulation,
        rrIndex: e.rrIndex,
      }));
    console.log('DEMO NoteEvents (jpop-royal / C / 8-Beat / bpm100):', JSON.stringify(sample, null, 2));
    expect(sample.length).toBe(8);
  });
});
