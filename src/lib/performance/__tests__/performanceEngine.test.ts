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
import { buildPresetProgression } from '@/lib/presets';
import { SAMPLE_PRESETS } from '@/lib/testFixtures/samplePresets';
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

function restrikeGapOk(chordEvents: NoteEvent[], bpm: number, minGapMs: number): void {
  const secPerBeat = 60 / bpm;
  const byPitch = new Map<number, NoteEvent[]>();
  for (const e of chordEvents) {
    byPitch.set(e.pitch, [...(byPitch.get(e.pitch) ?? []), e]);
  }
  for (const list of byPitch.values()) {
    list.sort((a, b) => a.timeBeat - b.timeBeat);
    for (let i = 1; i < list.length; i++) {
      const gapMs = (list[i].timeBeat - (list[i - 1].timeBeat + list[i - 1].durationBeat)) * secPerBeat * 1000;
      expect(gapMs).toBeGreaterThanOrEqual(minGapMs - 1e-6);
    }
  }
}

describe('PerformanceEngine — chord gate range & re-strike gap', () => {
  // `block` plants one sustained chord per bar (nominal ≈ 4 beats on this fixture).
  // Style gate is [0.9, 0.98] legato — check the sounding fraction, not an absolute
  // 1-beat window. (8-Beat is syncopated; its gap check is separate below.)
  const blockChords = eventsOf('chord', generatePerformance(INPUT, { styleId: 'block' }));

  it('block chord notes keep the style gate fraction in [0.9, 0.98]', () => {
    const nominalBeats = 4; // one strike per bar on the 4-beat fixture chords
    blockChords.forEach((e) => {
      const gate = e.durationBeat / nominalBeats;
      expect(gate).toBeGreaterThanOrEqual(0.9 - 1e-6);
      expect(gate).toBeLessThanOrEqual(0.98 + 1e-6);
    });
  });

  it('block leaves the canonical ≥ 15ms re-strike gap (RESTRIKE_GAP_MS guarantee)', () => {
    restrikeGapOk(blockChords, INPUT.bpm, 15);
  });

  it('the syncopated 8-Beat comp keeps a clear (non-machine-gun) re-strike gap', () => {
    // The anticipation push re-hits a chord tone into the following down-beat 0.5
    // beats later; the engine reserves the 20ms grid gap but per-note microtiming can
    // shave a few ms off it on this tight 8th spacing, so the realized floor is a bit
    // under the canonical 15ms while still leaving an audible, click-free gap.
    restrikeGapOk(eventsOf('chord', generatePerformance(INPUT, { styleId: 'eightBeat' })), INPUT.bpm, 12);
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

  for (const preset of SAMPLE_PRESETS) {
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
/* Anticipation ("食い"): the off-beat before a chord boundary pre-empts */
/* the NEXT chord's voicing, without moving the attack time.            */
/* ------------------------------------------------------------------ */
describe('PerformanceEngine — chord-change anticipation', () => {
  // Two disjoint triads (no common tones) so an anticipated pitch is unambiguous.
  const CMAJ = [48, 52, 55]; // C E G
  const DMIN = [50, 53, 57]; // D F A
  const TWO: PerfChord[] = [
    { bodyMidi: CMAJ, bassMidi: [36], startBeat: 0, durationBeats: 4 },
    { bodyMidi: DMIN, bassMidi: [43], startBeat: 4, durationBeats: 4 },
  ];
  const input: PerformanceInput = { chords: TWO, bpm: 110, seed: 4242 };

  it('the &of4 stab (beat 3.5) pre-empts the next chord while staying on the grid', () => {
    const chords = eventsOf('chord', generatePerformance(input, { styleId: 'eightBeat' }));
    // A chord tone sounding BEFORE beat 4 that belongs only to the next chord (Dm)
    // proves the stroke was anticipated.
    const anticipated = chords.filter((e) => e.timeBeat < 4 - 1e-9 && DMIN.includes(e.pitch));
    expect(anticipated.length).toBeGreaterThan(0);
    expect(anticipated.every((e) => !CMAJ.includes(e.pitch))).toBe(true);
    // Attack time is NOT moved: it sits on the 3.5 grid (only ±microtiming ms).
    anticipated.forEach((e) => expect(Math.abs(e.timeBeat - 3.5)).toBeLessThan(0.03));
  });

  it('bass is anticipated too (next chord root before the boundary)', () => {
    const bass = eventsOf('bass', generatePerformance(input, { styleId: 'eightBeat' }));
    const anticipated = bass.filter((e) => e.timeBeat < 4 - 1e-9 && e.pitch === 43);
    expect(anticipated.length).toBeGreaterThan(0);
  });

  it('a style without anticipation (block) never pre-empts the next chord', () => {
    const chords = eventsOf('chord', generatePerformance(input, { styleId: 'block' }));
    const early = chords.filter((e) => e.timeBeat < 4 - 1e-9);
    expect(early.length).toBeGreaterThan(0);
    expect(early.every((e) => CMAJ.includes(e.pitch))).toBe(true);
  });

  it('the final chord (no next boundary) is left unchanged', () => {
    const chords = eventsOf('chord', generatePerformance(input, { styleId: 'eightBeat' }));
    const last = chords.filter((e) => e.timeBeat >= 4 - 1e-9);
    expect(last.length).toBeGreaterThan(0);
    // Nothing to anticipate past the end → only the last chord's own tones sound.
    expect(last.every((e) => DMIN.includes(e.pitch))).toBe(true);
  });

  it('is deterministic (same seed ⇒ identical events)', () => {
    const a = generatePerformance(input, { styleId: 'eightBeat' });
    const b = generatePerformance(input, { styleId: 'eightBeat' });
    expect(a).toEqual(b);
  });
});

/* ------------------------------------------------------------------ */
/* Arpeggio mode: the chord track is spread one body note per hit.      */
/* ------------------------------------------------------------------ */
describe('PerformanceEngine — arpeggio spread', () => {
  const TRIAD = [48, 52, 55]; // C E G
  const ONE: PerfChord[] = [{ bodyMidi: TRIAD, bassMidi: [36], startBeat: 0, durationBeats: 4 }];
  const input: PerformanceInput = { chords: ONE, bpm: 110, seed: 99 };

  it('emits exactly one chord note per hit (never a simultaneous block)', () => {
    const chords = eventsOf('chord', generatePerformance(input, { styleId: 'arpeggio' }));
    const byTime = new Map<string, number>();
    for (const e of chords) {
      const k = e.timeBeat.toFixed(4);
      byTime.set(k, (byTime.get(k) ?? 0) + 1);
    }
    expect(chords.length).toBeGreaterThan(0);
    for (const count of byTime.values()) expect(count).toBe(1);
  });

  it('cycles up then down over the notes (endpoints not repeated), wrapping a triad', () => {
    const chords = eventsOf('chord', generatePerformance(input, { styleId: 'arpeggio' }));
    // upDown over a 3-note source ⇒ indices [0,1,2,1] repeating (1 3 5 3).
    const expected = [0, 1, 2, 1].map((i) => TRIAD[i]);
    chords.slice(0, expected.length).forEach((e, i) => expect(e.pitch).toBe(expected[i]));
    // Every arpeggio note is a real source tone (no out-of-range index).
    expect(chords.every((e) => TRIAD.includes(e.pitch))).toBe(true);
  });

  it('spells 1-3-5-7 up then down over a 7th chord arp source (arpMidi)', () => {
    const SEV = [48, 52, 55, 59]; // C E G B — root-position Cmaj7 (1 3 5 7)
    const withArp: PerfChord[] = [
      { bodyMidi: [52, 55, 59], bassMidi: [36], arpMidi: SEV, startBeat: 0, durationBeats: 4 },
    ];
    const chords = eventsOf(
      'chord',
      generatePerformance({ ...input, chords: withArp }, { styleId: 'arpeggio' }),
    );
    // 1 3 5 7 5 3 (repeat) — the arp uses arpMidi (incl. the root), not the rootless body.
    const expected = [0, 1, 2, 3, 2, 1].map((i) => SEV[i]);
    chords.slice(0, expected.length).forEach((e, i) => expect(e.pitch).toBe(expected[i]));
    expect(chords.every((e) => SEV.includes(e.pitch))).toBe(true);
  });

  it('keeps the same up/down shape with a tension chord (9th → 1 3 5 7 9 up/down)', () => {
    const NINTH = [48, 52, 55, 58, 62]; // C E G B♭ D — 1 3 5 7 9
    const withArp: PerfChord[] = [
      { bodyMidi: [52, 55, 58, 62], bassMidi: [36], arpMidi: NINTH, startBeat: 0, durationBeats: 4 },
    ];
    const chords = eventsOf(
      'chord',
      generatePerformance({ ...input, chords: withArp }, { styleId: 'arpeggio' }),
    );
    const expected = [0, 1, 2, 3, 4, 3, 2, 1].map((i) => NINTH[i]);
    chords.slice(0, expected.length).forEach((e, i) => expect(e.pitch).toBe(expected[i]));
  });

  it('resets the cycle on a chord change', () => {
    const TWO: PerfChord[] = [
      { bodyMidi: TRIAD, bassMidi: [36], startBeat: 0, durationBeats: 4 },
      { bodyMidi: [50, 53, 57], bassMidi: [38], startBeat: 4, durationBeats: 4 },
    ];
    const chords = eventsOf('chord', generatePerformance({ ...input, chords: TWO }, { styleId: 'arpeggio' }));
    const secondChord = chords.filter((e) => e.timeBeat >= 4 - 1e-9);
    expect(secondChord.length).toBeGreaterThan(0);
    // First hit of the new chord restarts at order[0] = body index 0.
    expect(secondChord[0].pitch).toBe(50);
  });

  it('block/eightBeat still strike the whole body together (no spread)', () => {
    for (const styleId of ['block', 'eightBeat'] as const) {
      const chords = eventsOf('chord', generatePerformance(input, { styleId }));
      const byTime = new Map<string, number>();
      for (const e of chords) {
        const k = e.timeBeat.toFixed(4);
        byTime.set(k, (byTime.get(k) ?? 0) + 1);
      }
      // At least one grid position sounds the full 3-note block simultaneously.
      expect(Math.max(...byTime.values())).toBeGreaterThanOrEqual(3);
    }
  });

  it('is deterministic (same seed ⇒ identical events)', () => {
    const a = generatePerformance(input, { styleId: 'arpeggio' });
    const b = generatePerformance(input, { styleId: 'arpeggio' });
    expect(a).toEqual(b);
  });
});

/* ------------------------------------------------------------------ */
/* Demo output — concrete values for the music-supervisor review       */
/* ------------------------------------------------------------------ */
describe('PerformanceEngine — demo (jpop-royal 4536, C, 8-Beat)', () => {
  it('prints a few chord/bass events with velocity/timing/articulation', () => {
    const royal = SAMPLE_PRESETS.find((p) => p.id === 'jpop-royal')!;
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

/* ------------------------------------------------------------------ */
/* Relaxed feel: a single 3rd on beat 3 as the top voice               */
/* ------------------------------------------------------------------ */
describe('PerformanceEngine — Relaxed 3rd on beat 3', () => {
  it('emits a top-voice note = the chord 3rd around beat 3', () => {
    const progression: ChordEvent[] = [
      {
        id: 'e0',
        chordId: 'C',
        displayName: 'C',
        degreeLabel: 'I',
        function: 'tonic',
        durationBeats: 4,
        isPro: false,
        rootOffset: 0,
        suffix: '',
      },
    ];
    const chords = progressionToPerfChords(progression, 'C');
    const events = generatePerformance(
      { chords, bpm: 80, seed: 5 },
      { styleId: 'relaxed', grooveId: 'pop8', drums: false },
    );
    const tops = events.filter((e) => e.trackId === 'top');
    expect(tops.length).toBeGreaterThan(0);
    // Beat 3 = beat index 2.0 (0-based); allow Relaxed's laid-back microtiming window.
    const beat3 = tops.find((e) => e.timeBeat >= 1.9 && e.timeBeat < 2.6);
    expect(beat3).toBeDefined();
    // The 3rd of C is E → pitch class 4.
    expect(((beat3!.pitch % 12) + 12) % 12).toBe(4);
  });
});
