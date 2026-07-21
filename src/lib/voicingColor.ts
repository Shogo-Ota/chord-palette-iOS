/**
 * Playback-path voicing layout (pure, UI/RN/Expo-independent). Used ONLY by the
 * progression playback/export path (`progressionToChordSpecs`) — never by the
 * context-free `chordMidiNotes` that drives single-chord previews and the keyboard
 * visual.
 *
 * Chord *quality* is never rewritten here. add9 / sus4 / 7ths / tensions are left
 * entirely to the user's library choice (arrangement UX). This module only
 * rearranges the chosen tones: rootless / open voicing so the bass (which already
 * carries the root) does not double the body's root, and dense stacks (≥5 notes)
 * shed the perfect 5th. Groove/feel belongs in the Performance Engine rhythm layer.
 *
 * Determinism: pure functions of their inputs; no randomness, no `Math.random`.
 */

/** Normalize a signed semitone value to a pitch class in [0, 11]. */
function pitchClass(n: number): number {
  return ((n % 12) + 12) % 12;
}

/**
 * Rootless / open re-voicing of a chord body (MIDI notes) whose root pitch class is
 * `rootPc`. Dense bodies (≥5 notes) first drop the perfect 5th (the least essential
 * color tone); then the duplicated root is removed since the bass owns it. Never
 * reduces the body below 2 notes. Returns a new ascending array; the input is not
 * mutated.
 */
export function refineBodyVoicing(body: number[], rootPc: number): number[] {
  const notes = [...body].sort((a, b) => a - b);
  const root = pitchClass(rootPc);

  // Open voicing: thin the 5th out of dense stacks (measured on the original body).
  if (notes.length >= 5) {
    const fifth = pitchClass(root + 7);
    const fifthIndex = notes.findIndex((n) => pitchClass(n) === fifth);
    if (fifthIndex >= 0) notes.splice(fifthIndex, 1);
  }

  // Rootless: the bass carries the root, so drop the body's (lowest) root copy —
  // but keep at least two body notes so a triad still reads as a chord.
  if (notes.length > 2) {
    const rootIndex = notes.findIndex((n) => pitchClass(n) === root);
    if (rootIndex >= 0) notes.splice(rootIndex, 1);
  }

  return notes;
}
