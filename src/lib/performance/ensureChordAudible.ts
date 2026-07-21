/**
 * Harmony invariant (safety net for the WHOLE engine). Whatever the style, feel,
 * variation, groove, seed, or future addition, the Performance Engine must never
 * emit a chord whose bar produces no HARMONY — a "that chord doesn't play" bug.
 * This runs LAST on the finished `NoteEvent[]` (after every style/variation/
 * humanize step) and, for any chord left with no harmony (chord/top) event inside
 * its own [start, end) window, injects a plain block chord on that chord's
 * downbeat so the chord itself is always heard.
 *
 * Why harmony (chord/top) and NOT bass: a short chord (e.g. a ¼-bar chord at a
 * fast tempo) hits its bass on the downbeat, but a style that places the chord
 * body slightly later (an off-beat comp, an 8th-note pattern, or a `bassOnly`
 * variation) can push every body strike PAST the chord's short window — leaving
 * only the bass sounding. Counting the bass as "audible" would let that slip
 * through as "the chord plays" when in fact only the low root is heard. Requiring
 * harmony guarantees the chord body itself sounds within every chord's window,
 * regardless of duration.
 *
 * It is deliberately style-agnostic and defensive: it inspects only the final
 * output, so it also protects direct styles (`block`/`arpeggio`) that bypass the
 * Variation layer and any style added later. In normal operation (a full bar
 * whose body sounds in-window) it injects nothing; it exists purely to make the
 * "chord doesn't play" failure mode impossible. Pure and deterministic — it
 * reuses the chord's own notes and the project seed, adding no randomness.
 */

import { clampVelocity, type NoteEvent } from './NoteEvent';
import type { PerfChord } from './PerformanceEngine';

const EPSILON = 1e-9;

/**
 * Tracks that make the CHORD itself audible. Bass is deliberately excluded: a bar
 * with only its low root sounding is the exact "low note plays but the chord
 * doesn't" bug this guard exists to prevent (see file header).
 */
const HARMONY_TRACKS: ReadonlySet<string> = new Set(['chord', 'top']);

/**
 * Low-side tolerance (beats) so a downbeat nudged slightly early by microtiming
 * still counts as sounding in its bar. Kept small so a neighbouring bar's late
 * off-beat is never miscredited to an actually-empty bar.
 */
const ONSET_TOLERANCE = 0.05;

/** Moderate, unaccented velocity/gate for an injected safety chord. */
const FALLBACK_VELOCITY = 84;
const FALLBACK_GATE = 0.9;

/** The notes to voice for a safety chord: body first, then bass, then arp source. */
function fallbackNotes(chord: PerfChord): number[] {
  if (chord.bodyMidi.length > 0) return chord.bodyMidi;
  if (chord.bassMidi.length > 0) return chord.bassMidi;
  if (chord.arpMidi && chord.arpMidi.length > 0) return chord.arpMidi;
  return [];
}

/**
 * Guarantee every chord's harmony is audible within its own window. Returns the
 * input untouched when it already is (the normal case); otherwise returns a new,
 * re-sorted list with the missing chords' block chords injected on the downbeat.
 */
export function ensureChordAudible(
  events: NoteEvent[],
  chords: PerfChord[],
  seed: number,
): NoteEvent[] {
  if (chords.length === 0) return events;

  const harmony = events.filter((e) => HARMONY_TRACKS.has(e.trackId));
  const injected: NoteEvent[] = [];

  for (const chord of chords) {
    const start = chord.startBeat;
    const end = chord.startBeat + chord.durationBeats;
    const audible = harmony.some(
      (e) => e.timeBeat >= start - ONSET_TOLERANCE && e.timeBeat < end - EPSILON,
    );
    if (audible) continue;

    const notes = fallbackNotes(chord);
    const durationBeat = Math.max(1 / 64, chord.durationBeats * FALLBACK_GATE);
    for (const pitch of notes) {
      injected.push({
        timeBeat: start,
        durationBeat,
        pitch,
        velocity: clampVelocity(FALLBACK_VELOCITY),
        articulation: 'normal',
        rrIndex: 0,
        trackId: 'chord',
        seed,
      });
    }
  }

  if (injected.length === 0) return events;
  return [...events, ...injected].sort((a, b) => a.timeBeat - b.timeBeat || a.pitch - b.pitch);
}
