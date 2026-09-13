# MIDI Export STYLE Name Acceptance

- Status: Ready for physical-device review
- Branch: `fix/midi-export-style-name`
- Base: `ce8b638` (`feature/video-style-flow-revision`)
- Review build number: 30
- Implementation commit: `fe74486`
- EAS build: `d5afbc35-442b-48f5-af13-f1fa6fce47ce` (FINISHED, built commit `fe74486`)
- Install: https://expo.dev/accounts/shogoota/projects/chord-palette/builds/d5afbc35-442b-48f5-af13-f1fa6fce47ce
- Device result: Not tested yet

## Defect

The STYLE segment of the exported `.mid` file name was spelled from the internal
`(accompanimentPattern, accompanimentVariant)` ids, which are historical and do not
match the eight STYLEs the Style screen offers. Six of the eight were therefore wrong.

| Selection | Playback identity | Old file name | Correct |
| --- | --- | --- | --- |
| Block | `block` + `block.type1` | `Block-Type1` | `Block` |
| Natural / Type 1 | `natural` + `natural.type1` | `Natural-Type1` | unchanged |
| Natural / Type 2 | `natural` + `natural.type2` | `Natural-Type2` | unchanged |
| Variation / City | `city` + `city.type1` | `City-Type1` | `Variation-City` |
| Variation / Funk | `natural` + `natural.type3` | `Natural-Type3` | `Variation-Funk` |
| Variation / Driving | `natural` + `natural.type4` | `Natural-Type4` | `Variation-Driving` |
| Variation / Dance | `natural` + `natural.dance1` | `Natural-dance1` | `Variation-Dance` |
| Arpeggio | `natural` + `natural.type5` | `Natural-Type5` | `Arpeggio` |

The selection itself always reached the export intact: the screen passes the live editor
session to the service, which passes it to the file-name builder. Only the naming was a
second, legacy system.

## Source of Truth

`src/lib/performance/publicStyleCatalog.ts` is now the only place that says how a
selection is named. Each of the eight STYLEs holds its group label, its type label and
the `(pattern, variant)` pair that plays and generates MIDI.

```
UI selection (editor session)
        |
        v
public STYLE catalog  --> Style screen groups and Style summary
        |             --> MIDI export file name
        v
(pattern, variant)    --> playback and MIDI generation (unchanged)
```

The Style screen model in `src/features/editor/accompanimentGroups.ts` is now a thin
adapter over the catalog rather than a second list, so a label cannot be maintained
twice and drift again. The export label is derived from the same labels the screen
shows — group name, plus the type name when the group offers more than one — with
spaces removed. A new STYLE therefore needs no export-side edit.

## File name

```
chord-palette-{STYLE}-{INSTRUMENT}-{BPM}bpm-{CHORDS}-{unix-ms}.mid
chord-palette-Variation-City-Piano-140bpm-FM7-E7-Am7-Gm7-C7-1786692801082.mid
```

The redundant `{Type}` segment is gone, since the STYLE label already carries it. The
trailing timestamp stays as before so repeated exports never collide in the cache.

## Scope

Changed: the public STYLE catalog (new), the Style screen presentation adapter, the
MIDI export file name and their tests.

Unchanged: PerformanceEngine, accompaniment note content, Groove, Energy, Voicing,
bass and drum generation, MIDI events, video export STYLE, UI design, and the set and
naming of STYLEs themselves.

## Automated evidence

- `npx tsc --noEmit` — clean.
- `npx eslint` on every changed file — clean.
- `npx jest` — 216 of 220 suites pass, 3002 tests pass. The 4 failing suites
  (`identityFidelity`, `phase3dVoiceStructure`, `pureTransposePhase2`,
  `userChordPhase3a`, 14 tests) need untracked teacher MIDI files and fail identically
  on the base commit.
- SMF byte identity: SHA-256 of `writeSmf(buildFinalMidiSnapshot(...))` for all eight
  selections (Piano, BPM 140, C-G-Am-F) is unchanged before and after this fix.

| Selection | SMF SHA-256 (before = after) |
| --- | --- |
| Block | `ff4a3392c57745e81298e179e28048e3cdb1833c41ce0720ab3df8eb98f8b344` |
| Natural-Type1 | `a2e2747519d1d0edda9d7d07f9d71cd098cc7597aed68aa9ef4535e990d70d54` |
| Natural-Type2 | `fed4b42a54d3b67d5dc619e56753ca8e81eb4c98a5fc23d432adc4ceb4f88ed2` |
| Variation-City | `4cf72b9a5285c85c53ef20a3ebdcd08b4fd118a64fb3b63d7fc5b2d90a6f213d` |
| Variation-Funk | `eb1f3fac7d4e6281110f71f031412ffa4c1de0162d97497222e2615c596134c2` |
| Variation-Driving | `8d7568568a5b836e3bce2f0fd61e9087e5e7497c46d0b48dbcd1505be8c91e09` |
| Variation-Dance | `b3e9141eaf266e7cc13b5fcaae11bf68f9aea62d45b07984c39048d322ecc826` |
| Arpeggio | `962814e2a8ece0aa4db12b80ae12603be35e77d2ec01bd47c246da4d154653f3` |

Tests added: the eight STYLE names, the parity between the screen groups and the export
names, absence of every retired token (`Natural-Type3/4/5`, `Natural-dance1`,
`City-Type1`, `Block-Type1`, any `type\d` or `dance1`), a STYLE switch not carrying the
previous name, BPM and progression changes reaching the name, the fallback for a retired
selection, and that each named variant is the one the engine resolves for playback.

## Physical-device checklist

Fix Piano, BPM 140 and one progression, then export MIDI once per STYLE in order.

1. Block -> `chord-palette-Block-Piano-140bpm-...mid`
2. Natural / Type 1 -> `Natural-Type1`
3. Natural / Type 2 -> `Natural-Type2`
4. Variation / City -> `Variation-City`
5. Variation / Funk -> `Variation-Funk`
6. Variation / Driving -> `Variation-Driving`
7. Variation / Dance -> `Variation-Dance`
8. Arpeggio -> `Arpeggio`

Also confirm:

- No file name contains `Natural-Type3`, `Natural-Type4`, `Natural-Type5`,
  `Natural-dance1` or `City-Type1`.
- Switching STYLE and exporting immediately shows the new STYLE, and exporting twice in
  a row does not repeat the previous one.
- The exported file plays the STYLE its name claims.
- The Style screen labels and the Style summary read as before.
- Video export is unaffected.
