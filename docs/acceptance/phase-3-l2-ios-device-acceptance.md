# Phase 3 (L2) iOS Device Acceptance

- Date: 2026-09-06
- Result: PASS
- Device / iOS: Registered physical iPhone / exact model and iOS version not captured
- Runtime: EAS Development Build `6d9402e6-95db-445e-8b43-7cb86e43fbac` with `EXPO_PUBLIC_CHORD_EVOLUTION_ENABLED=true`

## Checked scenarios

- App launch, Editor navigation, and existing UI
- Single-chord and whole-progression Evolution entry points
- Original / 7th / Rich candidate presentation
- Non-destructive Preview and repeated Preview
- Atomic Apply, single-operation behavior, and unaffected chord/settings preservation
- Existing Undo with one-step restoration and repeated Preview / Apply after Undo
- L2 tension/slash candidate behavior, candidate limit/order, and invalid-candidate exclusion
- Empty and short progression handling
- Existing chord editing, playback, Undo, Style, Energy, Performance Engine, and Production Voicing regression
- Interaction responsiveness, freeze absence, and runtime console errors

## Findings and resolution

1. The single-chord long-press menu contained unnecessary `長さ`, `ボイシング`, and `このコードだけの最低音と響きを変更します` text.
   - Resolution: Removed only these labels/hint while retaining the existing controls.
   - Retest: PASS on the physical iPhone.
2. The progression bar-count text was clipped.
   - Resolution: Moved progression metadata to a dedicated row and compacted the count to `current/max小節`.
   - Retest: PASS on the physical iPhone.

## Final automated gates

- `npm run typecheck`: PASS
- `npm run lint`: PASS with 0 errors and 46 pre-existing out-of-scope warnings
- `npm test -- --runInBand`: PASS
  - Test suites: 181 passed / 181 total
  - Tests: 2740 passed, 1 skipped / 2741 total

## Exclusions

- The existing Web Preview `expo-sqlite` / WASM resolution issue is out of scope and is not included in this acceptance result.
- No Web workaround was added.
- Plan files were not changed.

## Freeze

Phase 3 (L2) is accepted and frozen. Future changes require a confirmed defect or an explicit new-phase contract. When a later issue appears, first separate an L2 regression from behavior introduced by the new feature.
