# Chord Palette 1.0.5 Release Candidate

Updated: 2026-09-25
Version/build: `1.0.5 (34)` — `expo.version` set to `1.0.5`; `autoIncrement` bumps
`expo.ios.buildNumber` on each production build. Build 33 was superseded because it
carried the twelve-root `AUGMENTED TRIAD` group, which listed the same four
pitch-class sets three times each.
Branch: `feature/per-chord-style-override-latest`
Production build:
https://expo.dev/accounts/shogoota/projects/chord-palette/builds/008b2740-78d6-4913-86d2-caf88d4d21e9
Superseded build 33:
https://expo.dev/accounts/shogoota/projects/chord-palette/builds/d28bd4eb-1911-4ee4-82f6-b4401f90946c
Submission: [app-store-release-1.0.5.md](app-store-release-1.0.5.md)
Baseline release: `1.0.4 (32)`, production build
https://expo.dev/accounts/shogoota/projects/chord-palette/builds/ae369dff-1922-4d42-b128-972d832cfdba
(commit `ed365f1`)

`1.0.4` has since been approved and is Live, and App Store Connect reports
`In review: none`. The only step left before submission is device sign-off on build 34.

## Scope — what ships to players

- **Per-chord accompaniment STYLE.** Long-pressing a placed chord offers the eight
  public STYLEs plus 「全体のSTYLEを使用」. The choice applies to that one chord and
  never propagates to the chords after it, which is what separates it from a key
  change. A short badge appears on the degree line only, so a 1/4-bar card gains no
  row. Palette Pro owns setting and changing a STYLE; removal stays available after a
  lapse so a chord can always return to the project STYLE.

## Scope — what stays dark in production

- **Chord Evolution (L1–L3)**: `featureFlags.chordEvolution` resolves from
  `EXPO_PUBLIC_CHORD_EVOLUTION_ENABLED`, which the `production` profile does not set.
- **Chord Evolution L4 (Modal Interchange)**: absent from this lineage entirely.
  `src/lib/harmony/evolution/l4/` exists only on `feature/chord-evolution` (`e6b8ecc`),
  which branched at `1c1b408` and was never merged. L4 is additionally not wired to the
  UI on that branch — `generateL4EvolutionCandidates()` has no caller — so merging it
  would ship nothing to players while turning `phase4FreezeGate` red, because the
  release lineage has since changed `useChordEvolution.ts` for Comparison Draft.
  Deferred to its own release with UI wiring, labels, analytics and device acceptance.
- **Compare (聴き比べ)**: still isolated, no screen imports it.
- **Pulse video style**: retired from the TypeScript catalog and the selector; saved
  `pulse` preferences migrate to `classic`.

## Automated evidence

- [x] TypeScript (`tsc --noEmit`): 0 errors
- [x] ESLint on every changed file: 0 errors / 0 warnings
- [x] `git diff --check`: clean
- [x] Full Jest: 235 suites / 3176 passed / 1 skipped / 14 failed
- [x] The 14 failures are the four `humanTemplate` dataset suites
      (`identityFidelity`, `userChordPhase3a`, `phase3dVoiceStructure`,
      `pureTransposePhase2`), which need untracked teacher MIDI files and fail
      identically on the `1.0.4` baseline commit. No shipping code is involved.
- [x] `releaseAccompanimentBaselineV87`: the approved Final MIDI digests are byte
      identical, so a progression with no override sounds exactly as it did in 1.0.4
- [x] `sharedBaseVoicingProduction`: Shared Base pitch is unchanged by an override
- [x] `harmonyCollisionGate` / `harmonyCollisionContract`: reject count still 0
- [x] Baseline differential on 1- and 2-beat chords: an override adds zero new
      collision rejects, compared by rule / chord / beat / pitch rather than by count
- [x] Mixed-STYLE contracts: no anticipation or bass approach crosses a STYLE
      boundary, written NoteOff is clipped at the boundary, CC64 ownership is explicit,
      and same-beat order stays NoteOff → CC64 Up → CC64 Down → NoteOn
- [x] Loop terminal invariants: NoteOn and NoteOff counts match, every NoteOff lands
      within `totalBeats`, and a terminal pedal Up is added only when one is held
- [x] Per-chord parity: each chord sounds exactly as it does when the whole project
      plays that one STYLE, which is what proves phrase index, absolute beat and RNG
      sequence are untouched
- [x] Evolution freeze gate (`phase3FreezeGate`), Classic renderer freeze gate,
      Phase V4 frozen dependencies and the Pulse PNG goldens all pass unchanged
- [x] Video public style set remains exactly `classic | flow`
- [x] No dependency change, no DB migration, no Golden or digest fixture edit

## Internal builds

| Build | Focus |
|---|---|
| 32 | 1.0.4 production build (baseline) |
| Preview `b6fe4580` | Per-chord STYLE on the stale base — superseded, kept for traceability |
| Preview `2e8fa4ff` | Per-chord STYLE on the 1.0.4 base — **device and Sandbox billing approved** |
| 33 | 1.0.5, superseded — carried the twelve-root augmented group |
| 34 | 1.0.5 production build |

## Device checks on Preview build 32 (`2e8fa4ff`)

- [x] Long press works on 1/4-, 1/2- and full-bar chords
- [x] Only the eight public STYLEs and 「全体のSTYLEを使用」 appear
- [x] `C | Am | F | G`: overriding `F` leaves C, Am and G on the project STYLE
- [x] Changing the project STYLE moves the non-overridden chords and keeps `F`
- [x] 「全体のSTYLEを使用」 clears the badge and returns `F` to inheritance
- [x] Block → Natural, Natural → City, City → Dance, Dance → Natural all sound clean
- [x] 1- and 2-beat STYLE changes: no cut, no carried tail, no stuck pedal, no click
- [x] Loop with the override first, middle and last: no stuck pedal, no dangling note
- [x] MIDI export matches app playback in a DAW
- [x] Video export matches app playback, including STYLE switch positions
- [x] VoiceOver reads the menu action, the picker, the selected state and the full
      STYLE name on the timeline card
- [x] RevenueCat Sandbox: Free state, Paywall, purchase, `palette_pro`, immediate
      redraw, chord reselection, picker resume, no auto-apply, restore, lapse,
      removal-only after lapse, MIDI and Video still available, real package price
- [ ] Build 34 sign-off through TestFlight

## Release steps

1. [x] Commit the feature work and the 1.0.5 version bump
2. [x] `npx eas-cli build --platform ios --profile production`
3. [x] Record the produced build number and commit it
4. [x] `npx eas-cli submit --platform ios --profile production --id 008b2740` — the first
      attempt was canceled after two hours without reaching TestFlight; a re-run
      succeeded in four minutes
5. [x] Apple processing completed and the build visible in TestFlight
6. [ ] Owner device sign-off on build 34 through TestFlight
7. [x] `1.0.4` is Live and `In review: none`, so `1.0.5` can be created
8. [ ] Attach build 34, enter What's New and review notes, then submit for App Review
9. [ ] Review outcome recorded in `docs/app-store-release-1.0.5.md`
