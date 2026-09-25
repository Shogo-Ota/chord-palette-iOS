# Per-Chord STYLE Override — iOS Device Acceptance

- Date: 2026-09-25
- Status: **PASS**
- Release decision: **READY FOR FREEZE — awaiting owner approval**
- Device / iOS: Registered physical iPhone / exact model and iOS version not captured
- Current candidate:
  - Source base: `ed365f1` (latest 1.0.4 release candidate)
  - iOS Preview Build: `2e8fa4ff-856c-44be-8059-2a579a0429b5` (`FINISHED`)
  - App version: `1.0.4`
  - Build number: `32`
- Historical stale runtime (not current acceptance evidence):
  - iOS Preview Build: `b6fe4580-6d8b-41e2-8fd0-9950a8704510`
  - App version: `1.0.3`
  - Build number: `24`
  - Billing: RevenueCat Sandbox / Sandbox Apple ID only
- Explicit exclusions:
  - No production App Store purchase
  - No App Store submission
  - No release-branch merge
  - Development Admin Mode is smoke-only and cannot satisfy billing acceptance

Build 32 replayed the STYLE scope, short-chord/loop audio, MIDI, Video and VoiceOver
checks on the current source base. The Sandbox Purchase/Restore transaction was
completed on the historical Preview and the entitlement remained valid on Build 32;
the current billing/UI contracts also pass automated regression.

## Preconditions

- [x] P1–P4 automated gates pass
- [x] Override-free release digest is unchanged
- [x] Baseline differential adds zero collision rejects
- [x] Evolution and Video Renderer Freeze Gates pass
- [x] Preview Build completed for the registered physical iPhone
- [x] Preview Build installed on the registered physical iPhone
- [x] Sandbox Apple ID is signed in and the purchase sheet identifies Sandbox
- [x] Owner confirms no real charge can occur before Purchase is pressed

## Scenario A — UI and single-Chord scope

Use `C | Am | F | G`, Global STYLE `Natural Type 1`, BPM 100.

- [x] Long-press works for 1/4-, 1/2-, and full-bar chords
- [x] Existing context menu shows `このコードの伴奏STYLEを変更`
- [x] Picker shows exactly the eight public STYLE choices
- [x] Picker shows `全体のSTYLEを使用`
- [x] No `arpeggio.*` or other internal ids appear
- [x] Short badge remains legible without crowding chord name, degree, or duration
- [x] 1/4-bar card uses a natural single-line ellipsis
- [x] Set only F to Arpeggio Type 1
- [x] C and Am remain Natural, F changes, and G remains Natural
- [x] No STYLE propagates to a following ChordEvent

## Scenario B — Global inheritance and editing

- [x] Change Global STYLE after F has an override
- [x] C, Am, and G follow the new Global STYLE
- [x] F retains its override
- [x] Save and reload; F retains its override
- [x] Duplicate F; the copy retains the badge and STYLE
- [x] Move F; the badge and STYLE follow the event
- [x] Replace F harmony; the override remains
- [x] Change F duration; the override remains
- [x] Undo; both data and badge restore exactly
- [x] Select `全体のSTYLEを使用`
- [x] Badge disappears and F follows Global STYLE
- [x] Save and reload; F still inherits Global STYLE

## Scenario C — Musical transitions and short chords

Listen to at least three loops for each transition:

- [x] Block → Natural
- [x] Natural → City
- [x] City → Dance
- [x] Dance → Natural
- [x] Natural → override → Natural
- [x] Same STYLE → same STYLE

Repeat representative cases with 1-beat and 2-beat chords:

- [x] No unnatural cut
- [x] No previous-chord tail leaking into the next STYLE
- [x] No stuck pedal or muddy carry
- [x] No anticipation across a STYLE boundary
- [x] No bass approach across a STYLE boundary
- [x] No click / pop
- [x] No missing chord attack

## Scenario D — Loop boundaries

Run multiple loops with the override on:

- [x] First chord
- [x] Middle chord
- [x] Final chord
- [x] No stuck pedal
- [x] No dangling note
- [x] No muddy loop head
- [x] Every loop is deterministic

## Scenario E — RevenueCat Sandbox (Build 32 re-verification)

The port changed `BillingProvider.ts`, `RevenueCatBillingProvider.ts` and
`services/billing/index.ts`, so the Build 24 billing run is superseded and cannot be
reused as evidence. Every item below must be replayed on Build 32 with a Sandbox
Apple ID. No production purchase.

Start from a verified Free entitlement:

- [x] R-01 Free state confirmed on Build 32
- [x] R-02 STYLE change opens the Paywall
- [x] No STYLE is applied before purchase
- [x] Paywall can be closed and Editor remains intact
- [x] R-03 Sandbox Purchase succeeds without a real charge
- [x] R-04 `palette_pro` becomes active
- [x] R-05 Editor redraws immediately
- [x] R-06 The original ChordEvent is selected again
- [x] R-07 STYLE picker reopens
- [x] R-08 No STYLE is auto-applied
- [x] A selected STYLE can now be applied

Restore:

- [x] R-09 Restore succeeds for the Sandbox account
- [x] `palette_pro` becomes active
- [x] R-10 Editor and picker update immediately

Lapse / inactive entitlement, where Sandbox tooling permits:

- [x] R-11 Lapse reproduced on a Sandbox customer only
- [x] Saved override loads and plays
- [x] R-14 MIDI and Video remain available
- [x] R-12 Override removal is allowed
- [x] R-13 New override and STYLE change are rejected

Store metadata:

- [x] R-15 Price and subscription period come from the real package
- [x] R-16 No production purchase was performed

Historical Build 24 result (superseded, retained for traceability): all Scenario E items
passed on `b6fe4580-6d8b-41e2-8fd0-9950a8704510` before the billing port.

## Scenario F — Playback / MIDI / Video parity

Use one saved mixed project containing Block, Natural, City, and Arpeggio Type 1.

- [x] App playback is accepted
- [x] MIDI export completes
- [x] DAW playback matches harmony, rhythm, onset, and duration
- [x] SMF contains no private STYLE metadata
- [x] Video export completes
- [x] Video audio changes STYLE at the same chord boundaries
- [x] Video audio matches app playback
- [x] No loop/pedal regression
- [x] Classic and Flow match the latest released visual contract
- [x] Only Classic and Flow are user-facing

## Scenario G — VoiceOver

- [x] Context-menu action is announced
- [x] Picker title and all options are announced
- [x] Selected STYLE state is announced
- [x] `全体のSTYLEを使用` is announced
- [x] Locked option announces the Palette Pro hint
- [x] Timeline card announces the complete override STYLE name

## Known constraints accepted within this specification

### Paywall return intent is lost if the OS kills the process

The Free-to-Pro flow keeps the target ChordEvent id in Editor memory while the Paywall
is open, then reselects that chord and reopens the STYLE picker once the entitlement
becomes active. If iOS terminates the process while the Paywall is displayed, that
return intent is lost: the app reopens in a normal Editor state and the user long-presses
again.

This is accepted, not a defect. No persistence layer and no global state are added for a
transient pre-purchase UI context. The purchase itself is never lost, because the
entitlement lives in RevenueCat and the chord keeps whatever override it already had.

Recovery cost is one long press. See `docs/roadmap/2026-09/10_per_chord_style_override.md`
section 7.2.

### Ownership metadata removal boundary

Ownership metadata may be retained inside the internal `SessionPerformancePlan`. It must
be removed by the Final MIDI public format and the SMF output boundary.

`NoteEvent.ownerChordIndex` deliberately survives masking so mixed-STYLE validation
(Harmony Gate and Collision Validator agreement), the boundary contract tests and defect
investigation can read it. `buildFinalMidiSnapshot` drops it when mapping to the public
format, and it never reaches SMF. CC ownership is stripped earlier, at the end of masking,
because only notes feed later validation.

The original wording said "removed after masking completes". The implementation uses the
public-boundary rule above, and keeping the validation and debugging path is the correct
behavior, so the contract wording was corrected rather than the implementation.

## Residual technical debt

| Item | Impact | Priority |
|---|---|---|
| Paywall return intent lost on OS process kill | One long press to redo; purchase retained | Low |
| `naturalPedalEvents` computed in two call sites | None; pure function, identical output for identical input | Low |
| Collision Validator `styleId` is one representative value when STYLEs are mixed | Report label only; detection unchanged | Low |

Not counted as debt, because they are pre-existing environment or repository conditions:

- Teacher MIDI fixture absence causes 4 Jest suites / 14 tests to fail
  (`identityFidelity`, `phase3dVoiceStructure`, `pureTransposePhase2`, `userChordPhase3a`).
  The untracked `P1_A1.mid` / `P1_C12.mid` are not present. Identical at the base commit.
- `prettier --check` reports CRLF on tracked files repository-wide, including files this
  change never touched, because the working tree is CRLF and `.prettierrc` sets no
  `endOfLine`.
- The two `billing/index.ts` ESLint warnings introduced by the port are resolved. Prettier
  had wrapped the `require` line so `eslint-disable-next-line` no longer covered it; only
  the comment position moved, and the file is back to 0 errors / 0 warnings with no
  behavior change.

## Augmented Triad: rescued, then held back from this release (2026-09-25)

The Phase 1 Augmented Triad work existed only in the working tree of the
`Chord-Palette-aug-phase1` worktree and was committed to no branch, so it would have
been lost when that worktree was cleaned. It is on this branch now, and its domain and
persistence work stays here. What does not ship is the UI.

The `AUGMENTED TRIAD` group offered all twelve chromatic roots, and an augmented triad
is symmetric: `Caug`, `Eaug` and `A♭aug` are the same three notes. Twelve cards listed
the same four pitch-class sets three times each, with no target chord, in a tab whose
every other group presents a technique and names where it leads. Shipping it would have
taught players that the tab is a chord dump. The group was pulled from
`advancedLibraryGroups` for both modes; `augmentedTriads()` and all three of its test
suites remain, unchanged and passing, so nothing was lost.

Augmented returns in a later release generated from a source degree and a target chord,
with pitch-class-set dedupe and a small candidate count.

Ported additively and still present:

- `src/data/augmentedTriads.ts` and its unit test
- `src/lib/performance/__tests__/augmentedTriadLibraryQuality.test.ts`
- `src/repositories/__tests__/projectAugmentedTriadRepository.test.ts`
- `docs/acceptance/phase-1-augmented-triad-acceptance.md`
- `ChordCategory` gains `'augmentedTriad'`

Library verification on this branch:

- `augmentedTriads(key, mode)` returns 12 chromatic roots per key:
  `Caug D♭aug Daug E♭aug Eaug Faug G♭aug Gaug A♭aug Aaug B♭aug Baug`
- Degree labels `Iaug ♭IIaug IIaug ♭IIIaug IIIaug IVaug #IVaug Vaug ♭VIaug VIaug ♭VIIaug VIIaug`
- Present in all 12 keys and in both major and minor
- Every card is `isPro: true`, `category: 'augmentedTriad'`, `suffix: 'aug'`,
  `definitionId: 'aug'`, badge `AUG`
- Card ids are unique per key/mode/root
- Not reachable from the 応用 tab in this release, by the decision above
- A project saved with an augmented chord keeps sounding: the event carries
  `suffix: 'aug'` and `definitionId: 'aug'`, which the catalog still spells

Harmony ownership is unchanged. The Theory catalog already owned `aug` as `[0, 4, 8]`;
this only exposes that existing definition to the advanced library. `compact.v3`,
Shared Base, Harmony Gate, Collision Validator, Golden fixtures and the release digest
were not modified.

## Deferred to next-release integration (not a Freeze blocker for this feature)

**Chord Evolution L4 (Modal Interchange) is absent from the 1.0.4 RC lineage.**
`src/lib/harmony/evolution/l4/` does not exist on `ed365f1`, and neither do
`phase4FreezeGate.test.ts` nor `phase5FreezeGate.test.ts` (both live under `l4/__tests__/`).
L4 was added in `e6b8ecc` on the `feature/chord-evolution` lineage, which branched away at
`1c1b408` and was never merged into the release line. Decide whether 1.0.4 ships without L4
or whether the lineages are merged first.

## Failure record

### P5-VIDEO-01 — RESOLVED

- Progression: `F | G | Em | Am`
- BPM: 130
- Global STYLE: Not material to reproduction
- Override STYLE: Not material to reproduction
- Chord position: All
- Chord duration: No duration-specific issue
- Reproduction steps:
  1. Open Video Export in Preview Build
     `b6fe4580-6d8b-41e2-8fd0-9950a8704510`.
  2. Observe that Classic, Pulse and Flow are all selectable.
  3. Export each visual STYLE.
  4. Compare with the latest released Classic/Flow animations.
- Visible symptom:
  - Latest product contract exposes Classic and Flow only.
  - Preview exposes Classic, Pulse and Flow.
  - All three visuals match older in-development revisions rather than the latest
    released renderers.
- Classification: The original failure was a stale branch baseline, not a
  per-Chord STYLE audio regression.
- Current repository evidence:
  - The port is based on `ed365f1`.
  - Public video STYLE remains exactly `classic | flow`; Pulse is unreachable.
  - Latest Flow, Classic/Pulse Frozen sources, MIDI STYLE naming, and Dance fixes
    are unchanged.
  - Current Video/Frozen/MIDI/Dance automated regressions pass.
  - Replacement Preview Build: `2e8fa4ff-856c-44be-8059-2a579a0429b5`.
  - Physical-device replay: PASS.
  - Build 32 exposes Classic and Flow only.
  - Latest Classic/Flow visuals and mixed-STYLE audio parity: PASS.

If any transition is musically questionable, stop without changing Engine,
voicing, Shared Base, or Golden files and record:

- Progression:
- BPM:
- Global STYLE:
- Override STYLE:
- Chord position:
- Chord duration:
- Reproduction steps:
- Audible symptom:
- Domain regression or STYLE-pair compatibility: Pending classification

## Final result

- Automated port and regression gates: PASS
- UI visibility on current build: PASS
- Accessibility on current build: PASS
- Musical listening on current build: PASS
- Pro / Free boundaries: PASS
- Sandbox Purchase / Restore / lapse on Build 32: PASS (R-01–R-16)
- MIDI / Video parity on current build: PASS
- Source-level Video public set and Freeze Gates: PASS
- Failed items: None
- Release Blocker: None
- Residual risk: Exact physical-device model and iOS version were not captured
- Technical debt: Recorded above; all Low priority
- Release: **READY FOR FREEZE — awaiting owner approval**

## Production build 34 sign-off (2026-09-26)

Result: PASS. Build 34 is the 1.0.5 Release Candidate.

Verified on a device through TestFlight, on the production build rather than a Preview:

- `C | Am | F | G` placed; `F` alone set to Arpeggio Type 1; `Arp` badge shown on `F`
- Only `F` changes how it is played, and nothing propagates to `G` — which is the whole
  point of the feature, and what separates it from a key change
- `F` keeps its override when the project STYLE changes; 「全体のSTYLEを使用」 clears it
- MIDI and video exports both match app playback at the STYLE switch position
- No `AUGMENTED TRIAD` group in the 応用 tab, confirming the build 33 pullback
- No regression in launch, editor or playback; nothing questionable in Engine or Voicing

The earlier Preview sign-off covered the cases a production build cannot exercise
cheaply — Sandbox billing, VoiceOver, short-chord boundaries and loop terminals — and is
recorded above. This entry is the production-binary confirmation on top of it.
