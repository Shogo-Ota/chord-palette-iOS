# Dance Closing-Phrase Support Acceptance

- Status: Ready for physical-device review
- Branch: `fix/midi-export-style-name`
- Review build number: 31
- Implementation commit: `8ff82e1`
- EAS build: `078ff3a2-a4a3-426f-95b2-98d69da71d69` (FINISHED)
- Install: https://expo.dev/accounts/shogoota/projects/chord-palette/builds/078ff3a2-a4a3-426f-95b2-98d69da71d69
- Device result: Not tested yet

## Report

A 140-BPM sixteen-bar export (`Fadd9 Gsus4 Em7 Am7 Dm7 E7 Am7 Gm7 C7 Fadd9 Gsus4 G#dim7
Am7 Dm7 Gsus4 Fm C`, Variation / Dance) played the bar-15 `Fm` with 16 chord notes where
every other four-beat bar played 18.

The voicing was never at fault: `Fm` sounds `F2 / A♭3 C4 F4` and the closing `C` sounds
`C2 / G3 C4 E4`, both the same four-voice Shared Base Voicing as their neighbours. What
was missing is the `BASS + RH_BOTTOM` response on beat 1.5 — two notes of one rhythmic
layer.

That omission is the Dance profile's authored bar-7 dropout, the breath before the
eighth-bar roll/fill (`docs/dance-style-candidate-contract.md`). The first phrase did not
show it because its dropout bar was followed by the `Gm7`/`C7` split pair, which already
restores the response so two thinning devices do not stack. The second phrase had no such
neighbour, so the same phrase position sounded full in the first half of the export and
thin in the second.

## Change

The dropout support now has a second trigger: the progression breathes more than once and
this is its last dropout. One restrained `BASS + RH_BOTTOM @ 1.5` (velocity 80) returns,
exactly as the split-bar trigger already does.

A progression with a single dropout keeps the measured breath. An eight-bar progression is
therefore unchanged, which keeps the Dance eight-bar build audible where it is the whole
phrase, and the release gate `6 / 6 / 6 / 6 / 6 / 6 / 5 / 7` still describes the profile.

| Bars | First dropout | Closing dropout |
| --- | --- | --- |
| 8 | measured breath | — |
| 16 | measured breath (or split-bar support) | supported |
| 24 | measured breath | supported (only the last) |

## Changed files

- `src/lib/performance/naturalAtomic/danceDensityPolicy.ts` — the support decision now
  takes a context of two triggers, plus `closesRepeatedDropoutPhrase` to recognise the
  closing dropout. Renamed from `splitTerminalBarSupportAttack` so both triggers live in
  one function and cannot drift apart.
- `src/lib/performance/naturalAtomic/danceChordWindowPolicy.ts` — passes the two triggers.
- `src/lib/performance/naturalAtomic/rhythmProfiles.ts`,
  `src/lib/performance/naturalAtomic/timeline.ts` — thread the progression's end beat so a
  phrase-closing bar can be recognised. Other Styles ignore it.
- Tests: `danceDensityPolicy`, `danceChordWindowPolicy`, `danceStyleQuality`,
  `visualNoteTimeline`.
- `docs/dance-style-candidate-contract.md`.

## Automated evidence

- `npx tsc --noEmit` and `npx eslint` on every changed path — clean.
- `npx jest` — 216 of 220 suites, 3011 tests pass. The same 4 suites (14 tests) that need
  untracked teacher MIDI files fail identically on the base commit.
- Reported progression regenerated: the bar-15 `Fm` now plays
  `0 / 1 / 1.5 / 1.75 / 2.5 / 3.5` with 18 notes, matching every other four-beat bar. The
  bar-16 roll/fill is unchanged at `0 / 0.0438 / 1 / 1.75 / 2.5 / 3 / 3.5`, 20 notes.
- Same progression, other seven Styles, SMF SHA-256 before = after:

| Style | SMF SHA-256 |
| --- | --- |
| Block | `f169e6ca778ed6549696e2746219eaa91650c230043942ca83ec8753c69b0bad` |
| Natural-Type1 | `50df841b66dab4868388aa926018f9c91e5559edad75443dbd8171bdd94a01e1` |
| Natural-Type2 | `393fb10e29ae940ecf8fb0289fdc7878d8f4aadd2c7d723fda8e2d82be4f5024` |
| Variation-City | `4fdd361e4ddb9815129cf193b10deea2bd9c2eba587071d98e7bdf21ce73d839` |
| Variation-Funk | `a9676d7584412c9b605000cae62cdbd1fdde91855f43079aee2dbcb4c7fb2f5b` |
| Variation-Driving | `7996ee904b599e0e539ee4373c679e8ce58ba25051af6df9e1b80cfb1f8c0cfc` |
| Arpeggio | `d90704ec533207346a55bc5a31bcbb48adf9ec30e5961e10ef76c181e34b70f2` |

Variation / Dance is the only Style whose bytes change
(`1561651e…` → `11676f8a…`), and the difference is the two restored notes.

## Video

Flow reads its falling blocks from the same performance snapshot, so the restored pair
appears as blocks and keyboard landings with no renderer change. A `visualNoteTimeline`
test asserts the two velocity-80 notes reach the sidecar at the closing bar's beat 1.5 and
that the first phrase's breath stays empty.

## Physical-device checklist

1. Variation / Dance, Piano, BPM 140, the reported sixteen-bar progression: the closing
   `Fm` sounds as full as the bars before it, and the final `C` still reads as a fill.
2. The first phrase still breathes where the export shows it (bar 7), and the groove is
   unchanged elsewhere.
3. An eight-bar progression still breathes in its seventh bar.
4. The Flow video shows the restored beat-1.5 blocks landing with the left hand.
5. The other seven Styles sound unchanged, and playback matches the exported MIDI.
