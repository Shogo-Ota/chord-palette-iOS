# Chord library refinement (1.0.6 candidate)

Updated: 2026-09-26
Branch: `feature/diatonic-variation-redesign`
Base: `1.0.5 (34)` lineage

Two reworks of what the chord library offers, neither of which changes how anything
sounds. The Performance Engine, Energy Profile, Style, Voicing Engine, Chord Evolution,
MIDI export and video export are untouched.

## 1. Diatonic variations — offer what a degree can carry

The offer was built from what theory permits. It is now built from what is worth
reaching for, so a degree gets as many candidates as it can carry usefully and no more:
ii runs to `m13`, iii stops at four.

The reason a row is folded away moved from theory classification to usability. Each
degree owns an ordered list whose entries carry their own caption, quality, usability
and colour. That is what makes the order sus/add → 6 → 9 → 11 → 13 → 強い色づけ
expressible at all: the previous per-degree maps could not, because keys like `'6'` and
`'13'` are integer-like and JavaScript enumerates them before the sus/add keys.

Captions were wrong for a structural reason. The id `'9'` resolves to `maj9` on I, `m9`
on ii and `9` on V, but the label was shared across every degree, so `Dm9` was captioned
`9`. Labels now live on the degree entry and on the built chord's `subLabel`, so the two
rows of a card cannot disagree.

`オルタード` became `強い色づけ`. The old heading claimed these chords leave the scale,
which was false for `Am7(♭13)` and `Bm7♭5(♭13)` — both are built from notes inside C
major. The theory names moved to `colorClass`.

Removed: `Em7(♭9)` and `Bm7♭5(♭9)`, whose E–F and B–C semitones make them the easiest
chords to pick by accident; `Cmaj13`, `Cmaj13(#11)` and `Fmaj13`, too close to the
`maj9` beside them to be worth a slot; `Dm13(9,11)`, which named the same notes as
`Dm13` twice. `G7(♭9)` stays, because the dominant function is what the tension is for.

Added: `Cmaj7(#11)`, `Fmaj7(#11)`, `Em7(add11)`, `Em7(♭13)`, and — making vii° reachable
at all — the plain `Bm7♭5`, free because the seventh grid already gives it away, plus
`Bdim7` for how clearly it resolves to I.

Natural minor keeps its candidates; the major rework has no minor counterpart yet. It
took the caption fix and the ordering, plus ♭VI's #11 moving to 強い色づけ for the same
reason IV's does.

## 2. Advanced chords — techniques with named targets

Four of the five groups were already short, curated, and named where they lead:
secondary dominants (5, tonic V7 excluded by construction), the tritone substitute and
the backdoor (1 each, both aimed at the tonic), and the chromatic mediants (4). They are
unchanged.

Augmented was the exception, and it was not a smaller version of the same idea — it was
a chord type dumped into a tab of techniques. Twelve roots, no target, and an augmented
triad divides the octave evenly, so `Caug`, `Eaug` and `A♭aug` are the same three notes.
Twelve cards named four pitch-class sets three times each.

### The technique

Take a non-diminished degree, raise its fifth a semitone, and let that raised fifth
continue up into a tone of the next chord. In C: `C → Caug → F`, where G rises to G# and
then to A.

Target selection has two clauses. A perfect fourth above the source is preferred,
because that root motion is what the ear expects to resolve. When the degree a fourth up
cannot take the resolution, the smoothest arrival wins: the eligible chord sharing the
most tones with the augmented triad. That second clause is what sends `Faug` to `Dm`
rather than to `G`.

Generation covers every eligible degree; the tab shows at most three. In C major the
four generated are `Caug→F`, `Daug→G`, `Faug→Dm`, `Gaug→C`, and `Daug` is the one that
gives up its slot — it is the only candidate whose F# and A# are both outside the key.

Every card is spelled root + major 3rd + augmented 5th, so it reads `Caug` / `Daug` /
`Faug`. `Dm#5` names the same pitches but asks the player to think about an altered
minor chord, which is not this technique.

### Two kinds of deduplication

Symmetric duplicates are collapsed inside the connector generator, because which root to
keep is a musical decision: of the roots naming one pitch-class set, keep the one whose
raised fifth lands on a chord tone of a diatonic target. That keeps `Caug → F` over
`Eaug`, whose raised fifth would have to rise to C#.

Every row is then deduplicated on sounding notes, bass and destination. Notes alone
would be wrong. A diminished seventh is symmetric four ways, so `E♭dim7` and `F#dim7` are
the same four notes while one arrives at `Dm` and the other at `G`. Same notes with the
same destination is a duplicate; same notes heading elsewhere is a different technique.

### Progression context

`advancedLibraryGroups(key, mode, context?)` takes an optional progression. It can only
narrow the offer — no candidate exists because the progression is unknown. Diminished
connectors whose target is nowhere in the progression drop out, matched by degree
because the card points at the seventh chord (`→G7`) while the progression may hold the
triad (`G`). Augmented connectors are ordered by fit: one whose source is the selected
chord and whose target is the chord right after it outranks a textbook V+ with nowhere
to go.

When a progression supports no augmented connector the row shows a hint rather than
filler.

## Deliberate deviation from the brief

The brief asked to reuse the existing 候補生成 → Hard Validation → Deduplication →
Scoring → Diversity pipeline. That pipeline is `src/lib/harmony/evolution/l3/`, and it
belongs to Chord Evolution, not to the library: it is reached only through
`generateCandidates.ts` from `useChordEvolution`, which `featureFlags.chordEvolution`
keeps dark in production. Its `EvolutionCandidate` describes rewriting a span of a
progression as `before`/`after`, not a single library card.

Putting the advanced tab on it would mean converting cards to evolution candidates and
back, and coupling a shipping tab to a dark feature. The tab keeps its own thin provider
layer instead. No new theory tables were added: every rule reads from the existing
palettes in `src/lib/musicTheory/advancedPalette.ts` and the chord catalog.

## Modal Interchange

`modalInterchange()` exists in `src/data/music.ts` but is not an advanced-tab group. Its
only consumer is `src/lib/theory/progression/suggestNext.ts`, the suggestion bar. It is
correctly implemented and independent, so it was not touched and not duplicated.

Integrating it into the tab would first need duplicate resolution: its `♭VI` and `♭III`
share roots with the chromatic mediants' `♭VImaj7` and `♭IIImaj7`, differing only in
quality. That belongs to its own phase.

## Metadata the colour phase will need

The colour work (T green / SD yellow / D red / PASS blue / COLOR purple / CTX grey) was
explicitly out of scope, and no display colour changed. The metadata it needs is already
carried:

- Diatonic variations: `usability`, `colorClass`, `scaleCompatibility`,
  `dissonanceLevel`, `tensionClass` on every degree entry, readable through
  `degreeVariationsForMode(degree, mode)` and also passed onto `VariationPillModel`.
- Advanced cards: `function` (tonic / subdominant / dominant) and `category` on every
  card, plus `badgeLabel` where a card overrides the function badge.
- Augmented connectors: `sourceDegreeIndex`, `targetDegreeIndex`,
  `raisedFifthPitchClass`, `resolutionPitchClass` and `sharedWithTarget` on
  `AugmentedConnector`, which is what a CTX border would key off.

## Known gaps

- **Natural minor has no variation candidate spec.** Only captions and ordering were
  fixed. Minor iiø is the visible consequence: it is the one degree whose always-visible
  row is empty, while major vii° now leads with a free `m7♭5`.
- **`paywall.tsx` still says オルタード** in the Pro perk description. That is a perk
  description, not the variation heading the brief renamed, so it was left accurate to
  its own context.
- **Variation pills have no "tap again to clear".** `pickVariation` replaces or appends
  only. This predates the rework and was not changed.
- **`augmentedTriads()` is no longer reachable from the UI.** The function and its three
  test suites remain, covering the domain and the persistence. A project saved with an
  augmented chord still sounds: the event carries `suffix: 'aug'` and
  `definitionId: 'aug'`, which the catalog still spells.
