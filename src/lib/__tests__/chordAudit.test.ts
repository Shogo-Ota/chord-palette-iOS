/**
 * Exhaustive chord-playback audit. Enumerates EVERY chord the library can emit —
 * diatonic triads, diatonic sevenths, every diatonic variation per degree,
 * secondary dominants, modal interchange, and every slash/on-chord — across all
 * 12 major keys, and asserts that BOTH playback paths yield audible, valid notes:
 *
 *  - preview   : `chordMidiNotes` (single-chord audition + keyboard visual)
 *  - playback  : `progressionToPerfChords` (Performance Engine input, bass+body)
 *
 * "Audible + valid" means: at least one note, every note a finite integer inside
 * the MIDI range [0, 127]. This is the automated form of the user's request to
 * "check every chord" after finding a chord that would not sound. If any chord
 * (e.g. Em) produced an empty / out-of-range / NaN voicing at the logic layer,
 * this test pins it down deterministically.
 */

import { ACCOMPANIMENT_IDS, GROOVE_IDS } from '@/data/labels';
import {
  MAJOR_KEYS,
  availableVariations,
  chromaticBassNotes,
  diatonicLibrary,
  diatonicSeventhLibrary,
  modalInterchange,
  secondaryDominants,
  slashChord,
  variationChord,
} from '@/data/music';
import { generatePerformance } from '@/lib/performance/PerformanceEngine';
import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import { chordMidiNotes } from '@/lib/voicing';
import { mapPerfNotesToPlaybackRequest, performanceSeedFromSession } from '@/services/audio/performanceMapper';
import type { ChordDuration, ChordEvent, LibraryChord, MajorKey } from '@/types';

/** Minimal ChordEvent from a LibraryChord (only voicing-relevant fields matter). */
function toEvent(c: Pick<LibraryChord, 'rootOffset' | 'suffix' | 'bassOffset'>): ChordEvent {
  return {
    id: 'x',
    chordId: 'x',
    displayName: 'x',
    degreeLabel: 'I',
    function: 'tonic',
    durationBeats: 4,
    isPro: false,
    rootOffset: c.rootOffset,
    suffix: c.suffix,
    bassOffset: c.bassOffset,
  } as ChordEvent;
}

/** Every chord card the library can produce in `key`, with a human label. */
function allLibraryChords(key: MajorKey): { label: string; chord: LibraryChord }[] {
  const out: { label: string; chord: LibraryChord }[] = [];

  for (const c of diatonicLibrary(key)) out.push({ label: `triad ${c.displayName}`, chord: c });
  for (const c of diatonicSeventhLibrary(key)) out.push({ label: `7th ${c.displayName}`, chord: c });

  for (let degree = 0; degree < 7; degree++) {
    for (const id of availableVariations(degree)) {
      const c = variationChord(key, degree, id);
      out.push({ label: `var ${c.displayName}`, chord: c });
    }
  }

  for (const c of secondaryDominants(key)) out.push({ label: `secdom ${c.displayName}`, chord: c });
  for (const c of modalInterchange(key)) out.push({ label: `modal ${c.displayName}`, chord: c });

  // Slash / on-chords: every diatonic triad target over every chromatic bass note.
  for (const target of diatonicLibrary(key)) {
    for (const bass of chromaticBassNotes(key)) {
      const c = slashChord(key, target, bass);
      out.push({ label: `slash ${c.displayName}`, chord: c });
    }
  }

  return out;
}

/** A note is playable when it is a finite integer inside the MIDI range. */
function assertPlayableNotes(notes: number[], context: string): void {
  expect(notes.length).toBeGreaterThanOrEqual(1);
  for (const n of notes) {
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 127) {
      throw new Error(`${context}: invalid MIDI note ${n} in [${notes.join(', ')}]`);
    }
  }
}

describe('Chord audit — preview path (chordMidiNotes)', () => {
  for (const key of MAJOR_KEYS) {
    it(`every library chord in ${key} previews with valid, audible notes`, () => {
      for (const { label, chord } of allLibraryChords(key)) {
        const notes = chordMidiNotes(toEvent(chord), key);
        assertPlayableNotes(notes, `preview ${key} / ${label}`);
        // A real chord is more than a single bass note: expect the body too.
        expect(notes.length).toBeGreaterThanOrEqual(2);
      }
    });
  }
});

describe('Chord audit — playback path (progressionToPerfChords)', () => {
  for (const key of MAJOR_KEYS) {
    it(`every library chord in ${key} yields a non-empty voice-led voicing`, () => {
      for (const { label, chord } of allLibraryChords(key)) {
        const [perf] = progressionToPerfChords([toEvent(chord)], key);
        const sounding = [...perf.bassMidi, ...perf.bodyMidi];
        assertPlayableNotes(sounding, `playback ${key} / ${label}`);
      }
    });
  }
});

describe('Chord audit — full-progression voice leading keeps every chord sounding', () => {
  for (const key of MAJOR_KEYS) {
    it(`a progression of all diatonic triads in ${key} never drops a chord`, () => {
      const prog = diatonicLibrary(key).map((c) => toEvent(c));
      const perf = progressionToPerfChords(prog, key);
      perf.forEach((p, i) => {
        const sounding = [...p.bassMidi, ...p.bodyMidi];
        assertPlayableNotes(sounding, `progression ${key} / chord #${i}`);
      });
    });
  }
});

/**
 * Run the FULL playback pipeline the app uses (voice-lead → Performance Engine →
 * native playback mapping) and assert that EVERY chord bar contains at least one
 * pitched (chord/top/bass) note event. A chord whose whole [start, end) window has
 * zero events is exactly the "that bar goes silent during playback" bug the user
 * hit on Em. Attack times only shift by micro-timing/swing (a fraction of a beat),
 * so a generous ±0.4-beat tolerance keeps the check robust without masking a truly
 * empty bar.
 */
function chordEvent(rootOffset: number, suffix: string, durationBeats: ChordDuration = 4): ChordEvent {
  return { ...toEvent({ rootOffset, suffix }), durationBeats };
}

const WINDOW_TOLERANCE = 0.4;

/** Every pitched note event that lands inside a chord's [start, end) bar window. */
function eventsInChordWindow(
  events: { startBeat: number }[],
  startBeat: number,
  durationBeats: number,
): number {
  const lo = startBeat - WINDOW_TOLERANCE;
  const hi = startBeat + durationBeats - WINDOW_TOLERANCE;
  return events.filter((e) => e.startBeat >= lo && e.startBeat < hi).length;
}

/** Harmony (chord/top) note events inside a chord's [start, end) bar window. */
function harmonyInChordWindow(
  notes: { timeBeat: number; trackId: string }[],
  startBeat: number,
  durationBeats: number,
): number {
  const lo = startBeat - WINDOW_TOLERANCE;
  const hi = startBeat + durationBeats - WINDOW_TOLERANCE;
  return notes.filter(
    (n) =>
      (n.trackId === 'chord' || n.trackId === 'top') && n.timeBeat >= lo && n.timeBeat < hi,
  ).length;
}

describe('Chord audit — playback pipeline never renders a fully-silent chord bar', () => {
  // Em sits in every slot of a progression, plus a few common shapes, so a
  // position- or seed-specific drop is caught regardless of where Em lands.
  const EM: [number, string] = [4, 'm'];
  const C: [number, string] = [0, ''];
  const G: [number, string] = [7, ''];
  const F: [number, string] = [5, ''];
  const AM: [number, string] = [9, 'm'];
  const DM: [number, string] = [2, 'm'];

  const progressions: [string, [number, string][]][] = [
    ['Em first', [EM, C, G, F]],
    ['Em second', [C, EM, F, G]],
    ['Em third', [C, G, EM, AM]],
    ['Em last', [C, G, AM, EM]],
    ['Em x2', [EM, AM, EM, DM]],
    ['all diatonic C', [C, DM, EM, F, G, AM, [11, 'dim']]],
  ];

  for (const accompaniment of ACCOMPANIMENT_IDS) {
    for (const grooveId of GROOVE_IDS) {
      for (const [label, degs] of progressions) {
        it(`${accompaniment} / ${grooveId} / ${label}: every bar sounds`, () => {
          const progression = degs.map(([r, s]) => chordEvent(r, s));
          const key: MajorKey = 'C';
          const chords = progressionToPerfChords(progression, key);
          const totalBeats = chords.reduce(
            (max, c) => Math.max(max, c.startBeat + c.durationBeats),
            0,
          );
          const seed = performanceSeedFromSession({
            key,
            tempoBpm: 100,
            grooveId,
            accompanimentPattern: accompaniment,
            instrumentId: 'piano',
            progression,
          });
          const notes = generatePerformance(
            { chords, bpm: 100, seed },
            { styleId: accompaniment, grooveId, drums: false },
          );
          const req = mapPerfNotesToPlaybackRequest(notes, {
            bpm: 100,
            totalBeats,
            loop: true,
            drumPatternId: grooveId,
            instrument: 'piano',
          });

          chords.forEach((c, i) => {
            const count = eventsInChordWindow(req.chordEvents, c.startBeat, c.durationBeats);
            if (count === 0) {
              throw new Error(
                `${accompaniment}/${grooveId}/${label}: chord #${i} ` +
                  `[${c.startBeat}, ${c.startBeat + c.durationBeats}) has NO pitched events ` +
                  `(bodyMidi=[${c.bodyMidi}], bassMidi=[${c.bassMidi}])`,
              );
            }
          });
        });
      }
    }
  }
});

describe('Chord audit — every bar keeps its harmony (chord-floor guard)', () => {
  // The Variation `bassOnly`/`rests` rules could strip a whole bar's comp, and the
  // deterministic seed made that bar chord-less on every loop (user hit this on an
  // Em bar with the Natural feel). `ensureChordFloor` must keep ≥1 chord/top event
  // in every bar for the feel accompaniments too.
  const FEELS = ['natural', 'relaxed', 'driving'] as const;
  const EM: [number, string] = [4, 'm'];
  const C: [number, string] = [0, ''];
  const G: [number, string] = [7, ''];
  const F: [number, string] = [5, ''];
  const AM: [number, string] = [9, 'm'];
  const DM: [number, string] = [2, 'm'];
  const progressions: [string, [number, string][]][] = [
    ['Em first', [EM, C, G, F]],
    ['Em second', [C, EM, F, G]],
    ['Em third', [C, G, EM, AM]],
    ['Em last', [C, G, AM, EM]],
    ['royal', [F, G, EM, AM]],
    ['C G Am F', [C, G, AM, F]],
    ['Em x2', [EM, AM, EM, DM]],
  ];

  for (const feel of FEELS) {
    for (const grooveId of GROOVE_IDS) {
      for (const [label, degs] of progressions) {
        it(`${feel} / ${grooveId} / ${label}: no bar loses its harmony`, () => {
          const progression = degs.map(([r, s]) => chordEvent(r, s));
          const key: MajorKey = 'C';
          const chords = progressionToPerfChords(progression, key);
          const seed = performanceSeedFromSession({
            key,
            tempoBpm: 100,
            grooveId,
            accompanimentPattern: feel,
            instrumentId: 'piano',
            progression,
          });
          const notes = generatePerformance(
            { chords, bpm: 100, seed },
            { styleId: feel, grooveId, drums: false },
          );
          chords.forEach((c, i) => {
            const harmony = harmonyInChordWindow(notes, c.startBeat, c.durationBeats);
            if (harmony === 0) {
              throw new Error(
                `${feel}/${grooveId}/${label}: chord #${i} ` +
                  `[${c.startBeat}, ${c.startBeat + c.durationBeats}) has NO harmony (chord/top) events`,
              );
            }
          });
        });
      }
    }
  }
});

describe('Chord audit — the reported Em case is audible in every key', () => {
  // Em is rootOffset 4 + suffix 'm' regardless of key; verify it is never empty.
  for (const key of MAJOR_KEYS) {
    it(`Em previews and plays back with a full triad in ${key}`, () => {
      const em = toEvent({ rootOffset: 4, suffix: 'm' });
      const preview = chordMidiNotes(em, key);
      assertPlayableNotes(preview, `Em preview ${key}`);
      expect(preview.length).toBeGreaterThanOrEqual(3);

      const [perf] = progressionToPerfChords([em], key);
      const sounding = [...perf.bassMidi, ...perf.bodyMidi];
      assertPlayableNotes(sounding, `Em playback ${key}`);
      expect(sounding.length).toBeGreaterThanOrEqual(2);
    });
  }
});
