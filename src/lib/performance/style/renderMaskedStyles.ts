/**
 * Masked Multi-Render — how a progression with mixed STYLEs is performed.
 *
 * Each distinct STYLE renders the WHOLE progression through its existing realizer,
 * then contributes only the notes owned by the chords assigned to it.
 *
 * The alternative — slicing the progression into same-STYLE segments and rendering
 * each slice — cannot be used, and the reason is not obvious. Phrase position IS the
 * global chord index: the Natural rhythm reads `bars[chordIndex % 4]` and its pedal
 * reads `chordIndex % loopBars`, while the Block path derives its velocity RNG
 * stream from the draft's position in the array. Slicing rebases every one of those
 * from zero, so a chord would play a different bar of the phrase depending on what
 * its neighbours happen to be. Passing the full progression every time keeps phrase
 * index, absolute beat and RNG sequence structurally identical to a single-STYLE
 * render, which is also why a progression with no override is byte-identical.
 *
 * Cost is one full render per distinct STYLE (at most three, since the eight public
 * STYLEs are three realizers), not one per chord or per segment.
 */

import type { NoteEvent } from '../NoteEvent';
import type { PerfChord } from '../PerformanceEngine';
import type { FinalMidiControlChange } from '../finalMidi/types';
import { chordStyleKey, distinctChordStyles, type EffectiveChordStyle } from './effectiveStyle';
import {
  crossesStyleBoundary,
  renderOwnerChordIndex,
  type OwnedControlChange,
} from './renderOwnership';

/** Renders the full progression in one STYLE. Must be the unmodified existing path. */
export type StyleRenderResult = {
  notes: NoteEvent[];
  controlChanges: OwnedControlChange[];
};

export type MaskedStyleRenderResult = {
  notes: NoteEvent[];
  controlChanges: FinalMidiControlChange[];
};

export type ChordStyleRenderer = (style: EffectiveChordStyle) => StyleRenderResult;

const EPSILON = 1e-9;

/**
 * Order merged notes deterministically. Only ever reached when two STYLEs
 * contribute, so it cannot perturb a single-STYLE render. The leading
 * `timeBeat`/`pitch` keys match the engine's own sort; the rest exist so notes
 * arriving from different passes can never tie.
 */
function compareMerged(left: NoteEvent, right: NoteEvent): number {
  return (
    left.timeBeat - right.timeBeat ||
    left.pitch - right.pitch ||
    left.durationBeat - right.durationBeat ||
    left.velocity - right.velocity ||
    left.trackId.localeCompare(right.trackId)
  );
}

/**
 * The first beat at which another STYLE takes ownership after `ownerIndex`.
 * Same-STYLE chord changes are intentionally skipped: their written overlap is part
 * of the original realizer and must remain byte-identical within the STYLE run.
 */
function nextStyleBoundaryBeat(
  ownerIndex: number,
  chords: readonly PerfChord[],
  styleKeys: readonly string[],
): number | undefined {
  const ownerStyle = styleKeys[ownerIndex];
  for (let index = ownerIndex + 1; index < chords.length; index += 1) {
    if (styleKeys[index] !== ownerStyle) return chords[index]!.startBeat;
  }
  return undefined;
}

/**
 * End a written note exactly where another STYLE starts.
 *
 * This is a STYLE ownership rule, not a new articulation policy. It runs only in a
 * genuinely mixed render and only when the existing written NoteOff would survive
 * into a chord owned by another STYLE. Pitch, onset, velocity and same-STYLE gates
 * are untouched.
 */
function clipAtStyleBoundary(
  note: NoteEvent,
  ownerIndex: number,
  chords: readonly PerfChord[],
  styleKeys: readonly string[],
): NoteEvent {
  const boundary = nextStyleBoundaryBeat(ownerIndex, chords, styleKeys);
  if (boundary == null || note.timeBeat + note.durationBeat <= boundary + EPSILON) return note;
  const durationBeat = boundary - note.timeBeat;
  if (durationBeat <= EPSILON) return note;
  return { ...note, durationBeat };
}

function compareOwnedControlChanges(left: OwnedControlChange, right: OwnedControlChange): number {
  return (
    left.startBeat - right.startBeat ||
    // At one instant, release the previous pedal before pressing the next.
    (left.value < 64 ? 0 : 1) - (right.value < 64 ? 0 : 1) ||
    left.controller - right.controller ||
    left.ownerChordIndex - right.ownerChordIndex
  );
}

function pedalDownBefore(events: readonly OwnedControlChange[], beat: number): boolean {
  let down = false;
  for (const event of events) {
    if (event.controller !== 64 || event.startBeat >= beat - EPSILON) continue;
    down = event.value >= 64;
  }
  return down;
}

function hasPedalUpAt(events: readonly OwnedControlChange[], beat: number): boolean {
  return events.some(
    (event) =>
      event.controller === 64 && event.value < 64 && Math.abs(event.startBeat - beat) <= EPSILON,
  );
}

/**
 * Close any pedal state that would cross into another STYLE or survive the loop.
 * Runs only for mixed renders; the single-STYLE identity path remains byte-stable.
 */
function closePedalAtStyleBoundaries(
  events: OwnedControlChange[],
  chords: readonly PerfChord[],
  styleKeys: readonly string[],
): OwnedControlChange[] {
  const closed = [...events].sort(compareOwnedControlChanges);
  for (let index = 1; index < chords.length; index += 1) {
    if (styleKeys[index] === styleKeys[index - 1]) continue;
    const boundary = chords[index]!.startBeat;
    if (pedalDownBefore(closed, boundary) && !hasPedalUpAt(closed, boundary)) {
      closed.push({
        startBeat: boundary,
        controller: 64,
        value: 0,
        channel: 0,
        ownerChordIndex: index - 1,
      });
      closed.sort(compareOwnedControlChanges);
    }
  }

  const totalBeats = chords.reduce(
    (end, chord) => Math.max(end, chord.startBeat + chord.durationBeats),
    0,
  );
  if (
    totalBeats > 0 &&
    pedalDownBefore(closed, totalBeats + EPSILON) &&
    !hasPedalUpAt(closed, totalBeats)
  ) {
    closed.push({
      startBeat: totalBeats,
      controller: 64,
      value: 0,
      channel: 0,
      ownerChordIndex: Math.max(0, chords.length - 1),
    });
  }
  return closed.sort(compareOwnedControlChanges);
}

function stripControlOwnership(event: OwnedControlChange): FinalMidiControlChange {
  const { ownerChordIndex: _ownerChordIndex, ...controlChange } = event;
  return controlChange;
}

/**
 * Perform a progression whose chords may each name their own STYLE.
 *
 * With one distinct STYLE this delegates to the renderer and returns its output
 * untouched: same code path, same bytes as before per-chord STYLE existed. An empty
 * progression has no per-chord STYLE at all, which is why the project's own STYLE is
 * passed in rather than taken from the first chord.
 */
export function renderMaskedStyles(
  styles: readonly EffectiveChordStyle[],
  globalStyle: EffectiveChordStyle,
  chords: readonly PerfChord[],
  render: ChordStyleRenderer,
): MaskedStyleRenderResult {
  const distinct = distinctChordStyles(styles);
  if (distinct.length <= 1) {
    const rendered = render(distinct[0] ?? globalStyle);
    return {
      notes: rendered.notes,
      controlChanges: rendered.controlChanges.map(stripControlOwnership),
    };
  }

  const keyByChord = styles.map(chordStyleKey);
  const styleKeyOf = (chordIndex: number): string | undefined => keyByChord[chordIndex];
  const merged: NoteEvent[] = [];
  const mergedControlChanges: OwnedControlChange[] = [];

  for (const style of distinct) {
    const key = chordStyleKey(style);
    const rendered = render(style);
    for (const note of rendered.notes) {
      const ownerIndex = renderOwnerChordIndex(chords, note);
      if (styleKeyOf(ownerIndex) !== key) continue;
      if (crossesStyleBoundary(chords, note, styleKeyOf)) continue;
      merged.push({
        ...clipAtStyleBoundary(note, ownerIndex, chords, keyByChord),
        ownerChordIndex: ownerIndex,
      });
    }
    for (const controlChange of rendered.controlChanges) {
      if (styleKeyOf(controlChange.ownerChordIndex) !== key) continue;
      mergedControlChanges.push(controlChange);
    }
  }

  return {
    notes: merged.sort(compareMerged),
    controlChanges: closePedalAtStyleBoundaries(mergedControlChanges, chords, keyByChord).map(
      stripControlOwnership,
    ),
  };
}
