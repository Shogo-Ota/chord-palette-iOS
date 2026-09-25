# Chord Palette 1.0.5 Release Candidate

Updated: 2026-09-25
Version/build: `1.0.5 (33 expected)` — `expo.version` set to `1.0.5`;
`autoIncrement` bumps `expo.ios.buildNumber` from `32` during the production build.
Branch: `feature/per-chord-style-override-latest`
Production build: pending
Submission: [app-store-release-1.0.5.md](app-store-release-1.0.5.md)
Baseline release: `1.0.4 (32)`, production build
https://expo.dev/accounts/shogoota/projects/chord-palette/builds/ae369dff-1922-4d42-b128-972d832cfdba
(commit `ed365f1`)

`1.0.4` was submitted on 2026-09-14 and is Waiting for Review. `1.0.5` cannot be
submitted until that version leaves review, so the App Store Connect step below is
the gate, not the build.

## Scope — what ships to players

- **Per-chord accompaniment STYLE.** Long-pressing a placed chord offers the eight
  public STYLEs plus 「全体のSTYLEを使用」. The choice applies to that one chord and
  never propagates to the chords after it, which is what separates it from a key
  change. A short badge appears on the degree line only, so a 1/4-bar card gains no
  row. Palette Pro owns setting and changing a STYLE; removal stays available after a
  lapse so a chord can always return to the project STYLE.
- **Augmented triads in the 応用 library.** One `AUGMENTED TRIAD` group covering all
  twelve chromatic roots, in both major and natural minor, as Palette Pro cards. The
  Theory catalog already owned `aug` as `[0, 4, 8]`; this exposes that existing
  definition rather than redefining harmony.

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
- [x] Augmented triads: 12 unique roots in all 12 keys and both modes, every card
      `isPro`, `category: 'augmentedTriad'`, `definitionId: 'aug'`, badge `AUG`
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
| 33 (expected) | 1.0.5 production build |

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
- [ ] Augmented triads visible in the 応用 tab on a device
- [ ] Build 33 sign-off through TestFlight

## Release steps

1. [x] Commit the feature work and the 1.0.5 version bump
2. [ ] `npx eas-cli build --platform ios --profile production`
3. [ ] Record the produced build number and commit it
4. [ ] Confirm in App Store Connect that `1.0.4` has left review, so `1.0.5` can be created
5. [ ] `npx eas-cli submit --platform ios --profile production --id <build id>`
6. [ ] Apple processing completed and the build attached to version `1.0.5`
7. [ ] Enter What's New and review notes, then submit for App Review
8. [ ] Review outcome recorded in `docs/app-store-release-1.0.5.md`
