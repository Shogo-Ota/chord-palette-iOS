# Video Harmonic Role Visual Acceptance (Freeze)

- Status: **FROZEN.** Colour, glow and aura are settled. No further tuning without measured
  audience data.
- Branch: `feature/diatonic-variation-redesign`
- Frozen tree: `b280437` — the commit the reviewed build was made from
- Implementation commits: `7f9c404` … `b280437`
- Final review build: `37eca44f-4b0d-43af-8d31-045a8d340855` (`development`, FINISHED, `b280437`)
- Install: https://expo.dev/accounts/shogoota/projects/chord-palette/builds/37eca44f-4b0d-43af-8d31-045a8d340855
- Device result: **PASS** (iPhone, Flow export, 27 Sep 2026)

## The design that was accepted

Two facts about a chord, kept in two places, because one channel could not carry both.

**The body says what the chord does.** The glyph fill, the falling blocks and the keyboard all
take the harmonic-function colour they always took: tonic green `#22c55e`, subdominant amber
`#eab308`, dominant red `#ef4444`. This is the colour a viewer learns to read, so it does not
change when a chord happens to also be special. `F` and a borrowed `Fm` are the same amber.

**The light says why the chord is worth noticing.** Outline, near glow, diffuse glow and the
backdrop wash carry the technique. An ordinary chord gets no light at all — it sends no palette
entry, and renders byte-identically to how Flow always rendered it. Lighting every chord would
mark none of them.

## Accepted results

| Item | Result |
| --- | --- |
| Diatonic chords return to legacy Flow | **PASS** |
| Only advanced chords receive a special effect | **PASS** |
| Modal Interchange: function colour as body, technique in outline / glow / aura | **PASS** |
| Substitute: dominant red body, cyan special accent | **PASS** |
| Passing Diminished: `secondaryLeadingTone` and `chromaticPassing` read differently | **PASS** |
| `aura` separated as a fifth token | **PASS** |
| Borrowed `Fm` aura attenuated | **PASS** (about 42% less background luminance) |
| `B♭7` cyan aura | **PASS** (about 26% less, two-layer reading intact) |
| `G#dim7` no regression | **PASS** (no change at the comparison points) |
| Falling notes and keyboard stay legacy | **PASS** |
| Classic unchanged | **PASS** |

## Frozen values

Six accent families. The role a chord plays selects a family, except for the dominant
substitutes, which are overridden — see `visualAccentFamily.ts` for why a red light over a red
body said nothing.

| Family | accent | outline | glowCore | glowOuter | aura |
| --- | --- | --- | --- | --- | --- |
| `tension` | `#ff3b5c` | `#ff7a90` | `#ffb3c0` | `#ff3b5c` | `#ff3b5c` |
| `substitute` | `#22d3ee` | `#67e8f9` | `#a5f3fc` | `#22d3ee` | **`#0891b2`** |
| `secondaryTension` | `#ff5e8a` | `#ff93b0` | `#ffc2d4` | `#ff5e8a` | `#ff5e8a` |
| `leadingTension` | `#f038e8` | `#ff7bf3` | `#ffb5f8` | `#f038e8` | `#f038e8` |
| `color` | `#a855f7` | `#c99bff` | `#e0c4ff` | `#a855f7` | **`#4c1d95`** |
| `transition` | `#fbbf24` | `#fcd34d` | `#fde996` | `#fbbf24` | `#fbbf24` |
| `neutral` | `#94a3b8` | `#c2cdda` | `#dde4ec` | `#94a3b8` | `#94a3b8` |

Only `color` and `substitute` have an aura tuned away from their glow. Every other family keeps
its former value, which is what makes the new field a no-op for them.

`aura` is owned by the hero bloom and the frame backdrop. The glyph layers never read it, which
is what let the background be calmed without touching the letters.

## How the numbers above were obtained

Background regions were sampled from exported frames at matching positions, and read alongside
direct inspection on device.

**Glyph RGB measured from a downscaled contact sheet is not acceptance evidence.** Antialiasing
at contact-sheet scale pulls text toward white — a correctly amber `F` reads as `#b2afa8` and a
correctly red `G7` as `#cbb7c2`. Comparing ratios across two separately generated sheets is worse
still, because the tile geometry differs and the same proportional sample box lands on different
content; one such attempt sampled a green falling block instead of the chord name.

What counts, in order: background-region measurement from full-resolution frames, direct viewing
on device, and the semantic and token unit tests.

## What holds this in place

`src/services/videoExport/__tests__/harmonicRoleVisualFreezeGate.test.ts` pins the values and the
scope: the two tuned auras, the untuned families equal to their glow, `leadingTension` unchanged,
the aura unreachable from the glyph renderer and from the falling blocks and keyboard, no palette
at all for a diatonic-only progression, and no mention of roles anywhere in Classic.

The sibling `harmonicRoleVisualGate.test.ts` covers the wiring rather than the values: the
sidecar seam, the glyph filling from the segment, and the Classic payload gaining no field.

## Known limitation

In a C minor song, placing `Fm` from the **MODAL INTERCHANGE** card gives it the advanced
treatment even though its pitches are the plain diatonic `iv` of that key.

The card stamps `category: 'modalInterchange'`, and an explicitly stated technique always outranks
what the pitches suggest. That rule is what keeps `B♭7` a backdoor dominant and `E♭maj7` a
chromatic mediant instead of both being flattened into "borrowed", so it is not being weakened for
this case.

Accepted as a specification boundary. **No automatic correction.** Nothing infers a technique
from, or overrides one using, pitch content, a degree label string or the renderer.

## Out of scope for this work

Harmonic role resolution, borrowing inference, passing-diminished classification, project and
palette mode, degree labels, audio, the Performance Engine, Energy, and Classic.

## Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npx eslint` (touched paths) | PASS |
| `git diff --check` | PASS |
| Jest — `src/lib/videoExport`, `src/services/videoExport`, `src/features/editor` | PASS |
| Jest — full suite | 3442 passed; 14 pre-existing failures in `src/lib/performance/humanTemplate` |
| Swift | Compiled by EAS build `37eca44f`, FINISHED |

The 14 failures are four `humanTemplate` fidelity suites that fail identically on the tree before
this work. Confirmed by stashing the changes and re-running. They are unrelated and untouched.

## Next

Ship to Shorts and TikTok and measure whether the moment an advanced chord appears affects
retention and replays. Until that data exists, the token, glow and aura values do not move.
