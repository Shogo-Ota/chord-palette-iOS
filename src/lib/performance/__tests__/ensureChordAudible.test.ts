/**
 * Unit + invariant tests for the engine-wide audibility safety net. Proves both
 * the direct guard behaviour (`ensureChordAudible`) and the end-to-end promise
 * that NO accompaniment pattern can ever render a fully-silent chord bar.
 */

import { ACCOMPANIMENT_IDS, GROOVE_IDS } from '@/data/labels';
import { STYLE_IDS } from '@/lib/performance/styles';
import { ensureChordAudible } from '@/lib/performance/ensureChordAudible';
import { generatePerformance, type PerfChord } from '@/lib/performance/PerformanceEngine';
import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import { performanceSeedFromSession } from '@/services/audio/performanceMapper';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import type { ChordEvent, MajorKey } from '@/types';

function ev(rootOffset: number, suffix: string, durationBeats = 4): ChordEvent {
  return {
    id: 'x',
    chordId: 'x',
    displayName: 'x',
    degreeLabel: 'I',
    function: 'tonic',
    durationBeats,
    isPro: false,
    rootOffset,
    suffix,
  } as ChordEvent;
}

const PITCHED = new Set(['chord', 'top', 'bass']);
const TOL = 0.4;

/** Does any pitched event sound within a chord's [start, end) bar window? */
function barSounds(notes: NoteEvent[], c: PerfChord): boolean {
  const lo = c.startBeat - TOL;
  const hi = c.startBeat + c.durationBeats - TOL;
  return notes.some((n) => PITCHED.has(n.trackId) && n.timeBeat >= lo && n.timeBeat < hi);
}

describe('ensureChordAudible — direct guard', () => {
  const chords: PerfChord[] = [
    { bodyMidi: [55, 59], bassMidi: [40], startBeat: 0, durationBeats: 4 },
    { bodyMidi: [52, 55], bassMidi: [36], startBeat: 4, durationBeats: 4 },
  ];

  it('injects a block chord for a chord whose bar has no pitched events', () => {
    // Only the first chord sounds; the second bar is empty.
    const events: NoteEvent[] = [
      { timeBeat: 0, durationBeat: 3.6, pitch: 55, velocity: 90, articulation: 'normal', rrIndex: 0, trackId: 'chord', seed: 1 },
    ];
    const out = ensureChordAudible(events, chords, 1);
    const secondBar = out.filter((e) => e.timeBeat >= 4 && e.timeBeat < 8);
    expect(secondBar.length).toBeGreaterThan(0);
    // Injected notes voice the chord body of the empty bar.
    expect(secondBar.map((e) => e.pitch).sort()).toEqual([52, 55]);
    expect(secondBar.every((e) => e.velocity >= 1 && e.velocity <= 127)).toBe(true);
  });

  it('injects the chord body when a bar has ONLY its bass sounding (short-chord bug)', () => {
    // Regression: a ¼-bar chord hits its bass on the downbeat but the style's body
    // strike lands past the short window, so only the low root is heard. The bass
    // must NOT count as "the chord sounds" — the body is injected on the downbeat.
    const events: NoteEvent[] = [
      { timeBeat: 0, durationBeat: 3.6, pitch: 55, velocity: 90, articulation: 'normal', rrIndex: 0, trackId: 'chord', seed: 1 },
      { timeBeat: 4, durationBeat: 1, pitch: 36, velocity: 90, articulation: 'normal', rrIndex: 0, trackId: 'bass', seed: 1 },
    ];
    const out = ensureChordAudible(events, chords, 1);
    const secondBarBody = out.filter(
      (e) => e.trackId === 'chord' && e.timeBeat >= 4 && e.timeBeat < 8,
    );
    expect(secondBarBody.map((e) => e.pitch).sort((a, b) => a - b)).toEqual([52, 55]);
  });

  it('is a no-op when every bar already sounds', () => {
    const events: NoteEvent[] = [
      { timeBeat: 0, durationBeat: 3.6, pitch: 55, velocity: 90, articulation: 'normal', rrIndex: 0, trackId: 'chord', seed: 1 },
      { timeBeat: 4, durationBeat: 3.6, pitch: 52, velocity: 90, articulation: 'normal', rrIndex: 0, trackId: 'chord', seed: 1 },
    ];
    expect(ensureChordAudible(events, chords, 1)).toBe(events);
  });

  it('falls back to the bass when the body is empty', () => {
    const bassOnlyChord: PerfChord[] = [{ bodyMidi: [], bassMidi: [40], startBeat: 0, durationBeats: 4 }];
    const out = ensureChordAudible([], bassOnlyChord, 1);
    expect(out.map((e) => e.pitch)).toEqual([40]);
  });
});

const HARMONY = new Set(['chord', 'top']);

/** Does the CHORD (chord/top, not just the bass) sound within a chord's window? */
function barHasHarmony(notes: NoteEvent[], c: PerfChord): boolean {
  const lo = c.startBeat - 0.05;
  const hi = c.startBeat + c.durationBeats - 1e-9;
  return notes.some((n) => HARMONY.has(n.trackId) && n.timeBeat >= lo && n.timeBeat < hi);
}

describe('Harmony invariant — short (¼/½-bar) chords always sound the chord, not just bass', () => {
  // Mirrors the user report: from an Fmaj7 progression, ¼-bar Am7 and the trailing
  // C played only their bass. Every chord — at every short duration — must sound
  // harmony inside its own window across all patterns/grooves/tempos.
  const F7 = ev(5, 'maj7', 1);
  const AM7 = ev(9, 'm7', 1);
  const C4 = ev(0, '', 1);
  const G4 = ev(7, '', 1);
  const DM4 = ev(2, 'm', 1);

  const shortProgs: [string, ChordEvent[]][] = [
    ['Fmaj7→Am7→C (¼-bar)', [F7, AM7, C4]],
    ['all ¼-bar', [C4, G4, AM7, F7]],
    ['mixed ¼/½/full', [ev(5, 'maj7', 1), ev(9, 'm7', 2), ev(0, '', 4), ev(7, '', 1)]],
    ['¼-bar x8 (2 bars)', [C4, G4, AM7, F7, C4, G4, DM4, F7]],
  ];

  const patterns = Array.from(new Set<string>([...ACCOMPANIMENT_IDS, ...STYLE_IDS]));
  const tempos = [70, 132, 200];

  for (const pattern of patterns) {
    for (const grooveId of GROOVE_IDS) {
      it(`${pattern} / ${grooveId}: every short chord sounds harmony in its window`, () => {
        const key: MajorKey = 'C';
        for (const [label, progression] of shortProgs) {
          for (const bpm of tempos) {
            const chords = progressionToPerfChords(progression, key);
            const seed = performanceSeedFromSession({
              key,
              tempoBpm: bpm,
              grooveId,
              accompanimentPattern: pattern,
              instrumentId: 'piano',
              progression,
            });
            const notes = generatePerformance(
              { chords, bpm, seed },
              { styleId: pattern, grooveId, drums: false },
            );
            chords.forEach((c, i) => {
              if (!barHasHarmony(notes, c)) {
                throw new Error(
                  `${pattern}/${grooveId}/${label}@${bpm}bpm: chord #${i} ` +
                    `[${c.startBeat}, ${c.startBeat + c.durationBeats}) has NO HARMONY (bass only)`,
                );
              }
            });
          }
        }
      });
    }
  }
});

describe('Audibility invariant — NO accompaniment pattern ever renders a silent bar', () => {
  const EM = ev(4, 'm');
  const C = ev(0, '');
  const G = ev(7, '');
  const F = ev(5, '');
  const AM = ev(9, 'm');
  const DM = ev(2, 'm');
  const B_DIM = ev(11, 'dim');

  const progressions: [string, ChordEvent[]][] = [
    ['Em first', [EM, C, G, F]],
    ['Em second', [C, EM, F, G]],
    ['Em third', [C, G, EM, AM]],
    ['Em last', [C, G, AM, EM]],
    ['royal', [F, G, EM, AM]],
    ['Em x2', [EM, AM, EM, DM]],
    ['all diatonic', [C, DM, EM, F, G, AM, B_DIM]],
    ['two bar', [EM, C]],
    ['single', [EM]],
    ['long', [C, G, AM, F, C, G, EM, AM, F, G, C, EM]],
  ];

  // Cover BOTH the accompaniment ids the app exposes AND every raw style id, so a
  // future style added to STYLES is protected the moment it ships.
  const patterns = Array.from(new Set<string>([...ACCOMPANIMENT_IDS, ...STYLE_IDS]));
  const tempos = [70, 100, 132, 180];

  for (const pattern of patterns) {
    for (const grooveId of GROOVE_IDS) {
      it(`${pattern} / ${grooveId}: every bar of every progression/tempo sounds`, () => {
        const key: MajorKey = 'C';
        for (const [label, progression] of progressions) {
          for (const bpm of tempos) {
            const chords = progressionToPerfChords(progression, key);
            const seed = performanceSeedFromSession({
              key,
              tempoBpm: bpm,
              grooveId,
              accompanimentPattern: pattern,
              instrumentId: 'piano',
              progression,
            });
            const notes = generatePerformance(
              { chords, bpm, seed },
              { styleId: pattern, grooveId, drums: false },
            );
            chords.forEach((c, i) => {
              if (!barSounds(notes, c)) {
                throw new Error(
                  `${pattern}/${grooveId}/${label}@${bpm}bpm: chord #${i} ` +
                    `[${c.startBeat}, ${c.startBeat + c.durationBeats}) is SILENT`,
                );
              }
            });
          }
        }
      });
    }
  }
});
