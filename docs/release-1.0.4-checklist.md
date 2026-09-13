# Chord Palette 1.0.4 Release Candidate

Updated: 2026-09-13
Version/build: `1.0.4 (32 planned)` — production uses `autoIncrement`, so the
uploaded build number is one above the last local value (`31`).
Branch: `fix/midi-export-style-name`
Baseline release: `1.0.3 (24)`, production build
https://expo.dev/accounts/shogoota/projects/chord-palette/builds/80e17ed1-6885-4962-b88c-fbe15c39e4e7
(commit `7384f96`)

## Scope — what ships to players

- Video export offers two visual styles, **Classic** and **Flow**. Flow renders
  the performed notes falling onto the keyboard, with Classic's chord hero
  (font, pulse, glow) at the centre and the functional colours — tonic green,
  subdominant yellow, dominant red — shared with Classic.
- Flow spells the current chord's **degree** on the progress rail instead of the
  earlier ambiguous connection strip, and the bottom brand wordmark uses the
  Chord Palette rainbow.
- Exported **MIDI file names carry the STYLE the player selected** (the eight
  public names), never an internal pattern id.
- **Variation / Dance** fills the closing phrase dropout, so the last bars are
  as full as the phrase before them. Video output follows the same notes.

## Scope — what stays dark in production

- **Chord Evolution (L1–L3)**: `featureFlags.chordEvolution` resolves from
  `EXPO_PUBLIC_CHORD_EVOLUTION_ENABLED`, which the `production` profile does not
  set. Internal QA builds (`preview`) opt in.
- **Compare (聴き比べ)**: no screen imports `VideoTemplateSelector` or
  `useCompareVideoExport`; the module stays isolated for a later release.
- **Pulse video style**: retired from the TypeScript catalog and the selector;
  saved `pulse` preferences migrate to `classic`.

## Automated evidence

- [x] TypeScript (`tsc --noEmit`): 0 errors
- [x] Canonical lint (`expo lint`): 0 errors / 46 existing warnings
- [x] Full Jest: 220 suites / 3011 passed / 1 skipped / 14 failed
- [x] The 14 failures are the four `humanTemplate` dataset suites
      (`identityFidelity`, `userChordPhase3a`, `phase3dVoiceStructure`,
      `pureTransposePhase2`), which need untracked teacher MIDI files and fail
      identically on the `1.0.3` baseline commit. No shipping code is involved.
- [x] All eight public STYLEs name their export file from the selection, and the
      retired tokens (`City-Type1`, `Natural-Type3/4/5`, `natural.dance1`) never
      appear
- [x] The screen's STYLE groups and the export file name derive from the same
      `publicStyleCatalog`, so the two cannot drift
- [x] MIDI body digests for the seven unchanged STYLEs are identical to the
      pre-fix build; only Variation / Dance changes, and only in the closing
      dropout bar
- [x] Dance keeps a single measured dropout in an eight-bar progression and
      fills only the closing one when the phrase repeats
- [x] The restored Dance notes appear in the video note sidecar, so falling
      blocks match the audio
- [x] Flow landing timestamps equal the audio note onsets on every fixture
- [x] Classic golden frames and Classic/Pulse export inputs unchanged
- [x] Chord Evolution default flag is off and both Editor entries stay gated

## Internal builds

| Build | Focus |
|---|---|
| 25–26 | Flow performance-motion revision, Classic hero transplanted into Flow |
| 27–28 | Flow functional colours, branding, falling-block colour anchor |
| 29 | Flow rainbow wordmark and degree rail — **visuals approved on device** |
| 30 | MIDI export STYLE name fix |
| 31 | Variation / Dance closing-phrase support |

Latest internal build:
https://expo.dev/accounts/shogoota/projects/chord-palette/builds/078ff3a2-a4a3-426f-95b2-98d69da71d69

## Device checks before the production build

- [ ] Build 31: Variation / Dance sounds as full in the closing bars as earlier
      in the progression, and the groove is unchanged
- [ ] Build 31: the other seven STYLEs sound unchanged
- [ ] Build 31: exporting the eight STYLEs at one BPM and progression yields
      `Block`, `Natural-Type1`, `Natural-Type2`, `Variation-City`,
      `Variation-Funk`, `Variation-Driving`, `Variation-Dance`, `Arpeggio`
- [ ] Build 31: Classic and Flow video export, save and share all succeed
- [ ] Build 31: Chord Evolution and Compare entries are absent in a production
      build (verify after the production build is installed via TestFlight)
- [ ] Sandbox purchase / restore for Palette Pro on the production build

## Release steps

1. Owner confirms the device checks above.
2. `npx eas-cli build --platform ios --profile production` (20–60 min).
3. `npx eas-cli submit --platform ios --profile production --latest` (10–30 min
      including Apple processing).
4. Complete `docs/app-store-release-1.0.4.md` submission checks in App Store
   Connect and submit for review.
