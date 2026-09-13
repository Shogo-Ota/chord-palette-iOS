# Video Style Flow Revision Acceptance

- Status: Keyboard color and branding correction ready for physical-device review
- Branch: `feature/video-style-flow-revision`
- Base: `4ca43ef`
- Implementation commit: `f3d3a1a`
- Built commit: `4a72204c7a0456db22817d57556a2882bc025701`
- Review build number: 27
- Previous EAS build: `fbbc91be-289b-4528-959a-47cdb3d3fe20` (Build 26)
- EAS build: `c22ba7cb-4441-43d0-acf8-81f2efe3ced0` (FINISHED)
- Install: https://expo.dev/accounts/shogoota/projects/chord-palette/builds/c22ba7cb-4441-43d0-acf8-81f2efe3ced0
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

## Device acceptance

- The selector shows only Classic and Flow.
- A previously stored Pulse preference opens as Classic.
- Compare is absent from the export screen.
- Classic visuals, audio and duration are unchanged.
- Flow shows a large Classic-style chord label above moving note blocks.
- Falling blocks remain readable behind the chord label.
- Tonic, subdominant and dominant sections use green, yellow and red respectively.
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
- Full Jest: 215 suites / 2,969 tests PASS, 1 skipped
  - Known environment-only failures: 4 suites / 14 tests because the untracked
    teacher fixtures `P1_A1.mid` and `P1_C12.mid` are absent.
- Classic renderer, Classic adapter, retired Pulse renderer/state and VideoWriter:
  unchanged from `4ca43ef`.
- Preview config contains no Compare feature flag.
- Build 26 native Swift compile, signing and IPA generation: PASS.
- Build 27 native Swift compile, signing and IPA generation: PASS.
- Pixel review, color readability and audio landing sync remain physical-device
  checks.
