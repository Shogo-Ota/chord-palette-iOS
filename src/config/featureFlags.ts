/**
 * Feature Flags — gate UNIMPLEMENTED actions OUT of the UI (sprint-7 §3 / §5).
 *
 * Design contract (docs/design/ios-uiux-refinement.md §5):
 *   VISIBLE = READY. Any Action that is shown must be wired to a handler with a
 *   real outcome. Unimplemented Actions are NOT rendered `disabled` — they are
 *   hidden here so the Release build never exposes a dead control.
 *
 * These flags are read by the view-model layer (`useEditorActions`) and turned
 * into an `ActionState` of `'hidden'`, so the View never re-derives visibility.
 */
export type FeatureFlags = {
  /**
   * Metronome / click track.
   *
   * FALSE (hidden) for sprint-7. Rationale: the native audio engine
   * (`modules/chord-audio`) and its public abstraction (`src/services/audio`)
   * expose NO metronome/click parameter — `PlaybackRequest` carries only
   * bpm / totalBeats / loop / chordEvents / drumPatternId / accompaniment /
   * instrument. Wiring a real metronome would require an Audio Engine change,
   * which sprint-7 (UI polish / M4) explicitly forbids. Per §5 we therefore
   * HIDE the toggle rather than ship a dead Action. Flip to `true` only after
   * the engine gains a click track.
   */
  metronome: boolean;
};

/** Active flag values. */
export const featureFlags: FeatureFlags = {
  metronome: false,
};
