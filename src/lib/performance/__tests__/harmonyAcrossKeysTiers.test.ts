/**
 * Harmony invariant across the exact axes the user reported failing on device:
 * "changing key + toggling admin (Pro) / normal mode sometimes plays only the
 * bass". Admin mode flips the monetization tier free⇄pro, which changes humanize/
 * strum strength but must not change Shared Base Voicing. This suite drives the
 * real playback axes across all 12 keys × both tiers × both octave registers and
 * asserts every chord still sounds its harmony (chord/top, not just bass) inside
 * its own window.
 *
 * If this ever fails it pinpoints the (key, tier, register, pattern, groove)
 * combination that regressed — deterministically, without a device.
 */

import { ACCOMPANIMENT_IDS, GROOVE_IDS } from '@/data/labels';
import { MAJOR_KEYS } from '@/data/music';
import { generatePerformance, type PerfChord } from '@/lib/performance/PerformanceEngine';
import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import { tierProfile, type Tier } from '@/lib/performance/tier';
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

const HARMONY = new Set(['chord', 'top']);

/** Does the CHORD (chord/top, not just bass) sound within a chord's window? */
function barHasHarmony(notes: NoteEvent[], c: PerfChord): boolean {
  const lo = c.startBeat - 0.05;
  const hi = c.startBeat + c.durationBeats - 1e-9;
  return notes.some((n) => HARMONY.has(n.trackId) && n.timeBeat >= lo && n.timeBeat < hi);
}

// Progressions that mix full / ½ / ¼-bar chords — the durations most likely to
// push a body strike past a short window, plus a modulation-shaped run.
const PROGS: [string, ChordEvent[]][] = [
  ['mixed ¼/½/full', [ev(5, 'maj7', 1), ev(9, 'm7', 2), ev(0, '', 4), ev(7, '', 1)]],
  ['all ¼-bar', [ev(0, '', 1), ev(7, '', 1), ev(9, 'm7', 1), ev(5, 'maj7', 1)]],
  ['diatonic run', [ev(0, ''), ev(2, 'm'), ev(4, 'm'), ev(5, ''), ev(7, ''), ev(9, 'm')]],
];

const TIERS: Tier[] = ['free', 'pro'];
const SHIFTS = [0, 1]; // C2 floor and the default C3 (raised) register
// Keep the matrix bounded: a representative pattern/groove pair per family.
const PATTERNS = Array.from(
  new Set<string>(['block', 'natural', 'arpeggio', ...ACCOMPANIMENT_IDS]),
);
const GROOVES = GROOVE_IDS;
const BPM = 132;

describe('Harmony invariant — every key × tier(admin) × register still sounds the chord', () => {
  for (const key of MAJOR_KEYS) {
    it(`${key}: no chord is bass-only across free/pro, both registers, all patterns/grooves`, () => {
      for (const tier of TIERS) {
        const strength = tierProfile(tier);
        for (const octaveShift of SHIFTS) {
          for (const pattern of PATTERNS) {
            for (const grooveId of GROOVES) {
              for (const [label, progression] of PROGS) {
                const chords = progressionToPerfChords(progression, key as MajorKey, octaveShift);
                const seed = performanceSeedFromSession({
                  key: key as MajorKey,
                  tempoBpm: BPM,
                  grooveId,
                  accompanimentPattern: pattern,
                  instrumentId: 'piano',
                  progression,
                });
                const notes = generatePerformance(
                  { chords, bpm: BPM, seed },
                  {
                    styleId: pattern,
                    grooveId,
                    drums: false,
                    humanizeBoost: strength.humanizeBoost,
                    strumScale: strength.strumScale,
                  },
                );
                chords.forEach((c, i) => {
                  if (!barHasHarmony(notes, c)) {
                    throw new Error(
                      `${key}/${tier}/shift${octaveShift}/${pattern}/${grooveId}/${label}: ` +
                        `chord #${i} [${c.startBeat}, ${c.startBeat + c.durationBeats}) is BASS-ONLY`,
                    );
                  }
                });
              }
            }
          }
        }
      }
    });
  }
});
