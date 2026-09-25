# Phase 1 — Augmented Triad Acceptance

- Approved: 2026-09-24
- Base branch: `feature/chord-evolution`
- Base commit: `e6b8ecc36efa98369b0ca5e84cab9e389b1572d6`
- Product tier: Palette Pro
- Scope: Augmented Triad (`aug`) only

## 1. Goal

Expose the existing production `aug / [0, 4, 8]` chord definition in the editor's
「応用」library without changing the approved harmony, voicing, playback, export,
Golden, or Frozen contracts.

## 2. In scope

- All 12 chromatic-root Augmented Triad cards for each selectable key.
- Major and Natural Minor library modes.
- Canonical `Rootaug` display and persisted `aug` definition/suffix.
- `augmentedTriad` library/event category.
- Palette Pro placement and replacement.
- Free preview with the existing upgrade path; no Free placement or replacement.
- Preview, save/reload, transpose, playback, Final MIDI, and SMF export.
- Regression tests covering all 12 roots in both modes.

## 3. Out of scope

- `aug7` or any other augmented extension.
- Alias parsing or persistence for `+`, `+5`, or `#5`.
- Changes to `CHORD_CATALOG`, Theory DB, Shared Base, Harmony Gate, or Collision Validator.
- Chord Evolution support for Augmented Triads.
- Native audio/video code.
- Video Renderer changes.
- Golden or release digest updates.
- Count-in worktree changes.
- Billing/Admin fixes and per-chord accompaniment STYLE.

## 4. Product contract

1. The card appears in a dedicated `AUGMENTED TRIAD` group in the 「応用」tab.
2. The card follows the selected key and existing enharmonic spelling policy.
3. Major and Natural Minor expose the same tonic-root augmented harmony.
4. The card is never included in a diatonic group.
5. Display uses `Rootaug`; persistence uses `definitionId: "aug"` and `suffix: "aug"`.
6. The library category is `augmentedTriad`.
7. The card is marked Pro.
8. Free users can audition it through the shared preview path, while the progression remains unchanged.
9. The shared upgrade toast remains one tap away from the existing Paywall.
10. Pro users can append or replace a selected chord.

## 5. Harmony and voicing contract

- Allowed intervals relative to root are exactly `0`, `4`, and `8`.
- Augmented 5th (`#5`) is essential and may not be omitted.
- Every emitted accompaniment pitch belongs to the augmented triad.
- Harmony violations must be zero.
- Collision rejects must be zero for the Phase 1 corpus.
- Existing Shared Base and `compact.v3` policies remain unchanged.
- Existing Golden A–I and release digest fixtures remain unchanged.

## 6. Persistence and transpose contract

- Augmented events round-trip through the existing `chord_events` JSON storage.
- No SQLite schema migration is introduced.
- Legacy projects remain unchanged.
- Transpose preserves `aug` quality and root identity.
- Mode changes follow existing key/mode spelling policy and do not change `[0, 4, 8]`.

## 7. Playback and export contract

- Preview resolves the existing `aug` definition.
- Realtime playback, MIDI export, and video audio continue to share
  `buildSessionPerformancePlan` and `buildFinalMidiSnapshot`.
- The exported SMF is valid and contains only augmented-triad pitch classes for
  the tested accompaniment.
- No Native Module or Video Renderer change is permitted.

## 8. Required automated checks

- 12 keys × Major/Minor card generation.
- Canonical display, category, Pro flag, stable definition, and degree/root metadata.
- Free locked / Pro unlocked access policy.
- Preview includes root, major 3rd, and augmented 5th.
- Pro placement data shape.
- Repository save/reload round trip.
- Transpose across all supported keys and modes.
- Playback audibility.
- Harmony violation and collision reject counts.
- Final MIDI validation and parseable SMF output.
- Existing relevant Freeze Gates.
- TypeScript typecheck, lint, focused Jest, and full Jest when environment permits.

## 9. Manual checks

- Free: tapping an Aug card previews it, does not mutate the progression, and exposes the Paywall path.
- Pro: tapping appends or replaces and previews it.
- Major/Minor spelling is readable for all selectable keys.
- The card fits the existing advanced-library layout.

## 10. Stop conditions

Stop and request owner approval if implementation requires any of the following:

- A change to an existing Aug interval or Theory definition.
- A Shared Base, Harmony Gate, Collision, Golden, digest, or Frozen baseline amendment.
- A Native audio/video change.
- A new dependency.
- An `aug7` or alias-parser expansion.
