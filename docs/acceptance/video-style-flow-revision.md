# Video Style Flow Revision Acceptance

- Status: Brand wordmark and rail degree revision ready for physical-device review
- Branch: `feature/video-style-flow-revision`
- Base: `4ca43ef`
- Implementation commit: `f98f115`
- Built commit: `f98f115`
- Review build number: 29
- Previous EAS build: `ae253196-7cae-426d-9ea8-bb743302ff25` (Build 28)
- EAS build: `58e95c75-fa15-4b45-81f1-5d81d2835638` (FINISHED)
- Install: https://expo.dev/accounts/shogoota/projects/chord-palette/builds/58e95c75-fa15-4b45-81f1-5d81d2835638
- Device result: Not tested yet

## Approved direction

- The selectable video effects are Classic and Flow only.
- Existing stored Pulse selections migrate to Classic.
- Pulse is removed from the user-facing and TypeScript export contract. Frozen native
  Pulse source remains unreachable for compatibility and Golden preservation.
- Flow keeps its performance-note timeline, falling blocks and keyboard landings.
- Flow adopts the Classic visual hierarchy for the current chord and degree.
- Falling blocks render behind the chord text.
- Current harmonic-function color is taken from the existing segment contract:
  tonic green, subdominant yellow and dominant red.
- Compare is not user-facing. The Preview build flag is disabled while its isolated
  implementation remains available for later removal without affecting Standard.

This decision supersedes the earlier no-function-color Flow direction and the CP-2
user-facing Compare requirement. The previously approved plan files are not edited.

## Freeze boundary

- `FrameRenderer.swift` and `ClassicFrameRendererAdapter.swift` stay unchanged.
- `PulseFrameRenderer.swift` and `PulseFrameState.swift` stay unchanged and unreachable.
- Audio, Performance, Project persistence and `VideoWriter.swift` stay unchanged.
- Flow note timing and `VisualNoteTimeline` stay unchanged.

## Classic Hero refinement

- Flow uses the same center system font sizes and weights as Classic.
- Flow uses the same BPM pulse decay, chord-transition easing, scale amplitude,
  radial bloom and text shadow constants as Classic.
- Falling blocks remain behind the bloom and chord text.
- This is implemented by a Flow-only Hero renderer; `FrameRenderer.swift` remains
  byte-for-byte unchanged.

## Keyboard color and branding correction

- Landing intensity remains driven by each exact visual note event.
- Every sounding-key highlight uses the current chord segment color, preventing a
  previous sustained note from carrying the wrong harmonic-function color forward.
- Future falling blocks retain their owning segment color as harmonic anticipation.
- Flow branding is a horizontally centered lockup of the approved icon and the plain
  product name `Chord Palette`.

## Falling block color binding and header cleanup

- A falling block is colored by the chord whose voicing it plays, not by its own
  onset. Micro-timing and the anticipation push ("食い") place an attack slightly
  ahead of a chord change, which previously painted the incoming chord's notes in the
  outgoing function color.
- The owning chord is resolved by the existing Harmonic Gate binding
  (`chordIndexForNote`: declared anticipation first, then its 1/8-beat early-attack
  window), so video color and harmony validation can never disagree.
- The sidecar carries that chord's onset as `harmonyStartSec`. Native color lookup
  reads it and keeps a 1 ms boundary tolerance for float accumulation; a payload
  without the field falls back to the note onset, so older plans still render.
- Note timing, geometry, landing intensity and audio remain untouched — this is a
  color-selection change only.
- The header shows the title and BPM only; the `FLOW` style label is removed because
  the style is already chosen in the export UI.

## Brand wordmark and rail degree revision

- Approved information priority: chord name, degree, progression position, keyboard and
  note motion, then branding.
- Flow's bottom lockup now draws the in-app wordmark: brand font with `Chord ` in bright
  text and `Palette` filled with the theme `rainbow` gradient, clipped to its glyphs.
- Wordmark drawing lives in its own Flow renderer; the brand renderer only resolves the
  icon and wordmark layout. Classic keeps its identical lockup inside the frozen
  renderer, and the architecture gate compares both definitions against theme tokens so
  the brand cannot drift.
- The rail no longer repeats chord names, which duplicated the hero. It spells the
  harmonic role (`degreeLabel`) of the current chord and up to two chords on each side;
  every other slot stays a position dot.
- Neighbour selection uses cycle distance, so the chords on either side of the loop seam
  keep their context.
- Classic already draws position dots only and the rainbow lockup, so it needs no change
  and stays frozen.

## Device acceptance

- The selector shows only Classic and Flow.
- A previously stored Pulse preference opens as Classic.
- Compare is absent from the export screen.
- Classic visuals, audio and duration are unchanged.
- Flow shows a large Classic-style chord label above moving note blocks.
- Falling blocks remain readable behind the chord label.
- Tonic, subdominant and dominant sections use green, yellow and red respectively.
- Blocks landing on a chord change carry that chord's function color, including at
  the loop boundary.
- No `FLOW` label appears above the chord.
- The bottom lockup reads `Chord` plus a rainbow `Palette` next to the icon, matching
  Classic and the in-app wordmark.
- The rail shows the current degree with at most two neighbours; remaining slots are
  dots, and the chord name is never repeated there.
- Falling-note landing and keyboard highlights remain synchronized to audio.
- Save and Share remain functional.

## Automated evidence

- TypeScript typecheck: PASS
- Changed-scope ESLint: PASS (0 errors)
- Style/Flow/Freeze focused: PASS (11 suites / 94 tests)
- Post-fix focused: PASS (7 suites / 46 tests)
- Classic Hero + timing/Freeze focused: PASS (5 suites / 42 tests)
- Video Export regression: PASS (17 suites / 121 tests)
- Keyboard color and branding regression: PASS (17 suites / 121 tests)
- Block color binding regression: PASS (15 suites / 125 tests), including new
  harmony-anchor contracts for a micro-timed early attack, a declared anticipation and
  anchor alignment with export segment boundaries
- Brand wordmark and rail degree regression: PASS (13 suites / 105 tests), including new
  Classic-parity contracts for the rainbow lockup and the rail degree window
- Full Jest: 215 suites / 2,976 tests PASS, 1 skipped
  - Known environment-only failures: 4 suites / 14 tests because the untracked
    teacher fixtures `P1_A1.mid` and `P1_C12.mid` are absent.
- Classic renderer, Classic adapter, retired Pulse renderer/state and VideoWriter:
  unchanged from `4ca43ef`.
- Preview config contains no Compare feature flag.
- Build 26 native Swift compile, signing and IPA generation: PASS.
- Build 27 native Swift compile, signing and IPA generation: PASS.
- Build 28 native Swift compile, signing and IPA generation: PASS.
- Build 29 native Swift compile, signing and IPA generation: PASS.
- Pixel review, color readability and audio landing sync remain physical-device
  checks.
