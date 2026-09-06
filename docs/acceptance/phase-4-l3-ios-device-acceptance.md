# Phase 4 (L3) iOS Device Acceptance

- Date: 2026-09-06
- Result: PASS (L3 Harmonic Evolution scope)
- Device / iOS: Registered physical iPhone / exact model and iOS version not captured
- Runtime: Existing EAS Development Build connected to LAN Metro with `EXPO_PUBLIC_CHORD_EVOLUTION_ENABLED=true`

## Checked scenarios

- Existing Editor launch and progression-wide Evolution entry
- Original / 7th / Rich / Reharm presentation
- Major-key Secondary Dominant, Passing Diminished, and Tritone Substitute proposals
- Japanese technique title and concise rationale
- Deterministic diversified candidate list with a Top 3 limit
- Non-destructive Preview
- Free Preview and Pro-gated Apply
- Atomic Apply and single-step Undo
- Repeated Preview / Apply / Undo operation
- Natural Minor fail-closed Reharm state
- Existing single-chord Original / 7th / Rich behavior
- Existing editing, playback, Style, Energy, Performance Engine, and Production Voicing regression

## Findings and resolution

1. The Reharm candidate list was clipped at the sheet bottom.
   - Initial mitigation: Constrained the sheet/body height and gave the candidate list a bounded flex scroll area.
   - Retest: The issue remained because the surrounding backdrop `Pressable` still competed for the drag responder.
   - Final resolution: Separated the dismiss backdrop into an absolutely positioned control behind a normal `View` sheet, removed the competing responder, and retained the bounded candidate `ScrollView`.
   - Retest: The user confirmed the Reharm presentation improved on the physical iPhone.
2. Four-count timing occasionally felt delayed.
   - Diagnosis: The accepted build triggers each native count-in click from `DispatchQueue.asyncAfter`; device diagnostics also showed variable count-in completion timing.
   - Proposed implementation: Pre-schedule all four MIDI clicks on the native audio sample timeline.
   - Verification status: Deferred by user choice because EAS monthly build credits were exhausted. No paid build was started.
   - Scope status: This audio follow-up is not included in the L3 PASS or Phase 4 commit.

## Final automated gates

- `npm run typecheck`: PASS
- `npm run lint`: PASS with 0 errors and 46 pre-existing out-of-scope warnings
- `npm test -- --runInBand`: PASS
  - Test suites: 193 passed / 193 total
  - Tests: 2819 passed, 1 skipped / 2820 total
- Phase 3 normalized-hash Freeze Gate: PASS
- L3 Architecture Gate: PASS

## Exclusions

- Existing Web Preview `expo-sqlite` / WASM resolution issue
- Web-specific workarounds
- Deferred native Count-in build and device acceptance
- Plan-file changes

## Freeze

Phase 4 L3 Harmonic Evolution is accepted and frozen. The unverified native Count-in follow-up remains outside this freeze and must pass a new iOS Development Build before release.
