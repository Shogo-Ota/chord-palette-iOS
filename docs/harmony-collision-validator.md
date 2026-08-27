# HarmonyCollisionValidator

The hard gate for unintended dissonance in generated accompaniment. Its job is to
guarantee that a voicing is not merely theoretically correct but unlikely to sound
muddy.

## Why MIDI distance and not interval class

Every verdict reads the sounding distance between two MIDI note numbers. Pitch class
intervals are never sufficient, and the reason is audible:

| Pair | Pitch classes | Distance | Verdict |
| --- | --- | --- | --- |
| `B3 + C4` | B, C | 1 | REJECT — close minor second |
| `C4 + B4` | C, B | 11 | ALLOW — major seventh, the sound of `Cmaj7` |
| `C4 + Db4` | C, D♭ | 1 | REJECT — close minor second |
| `C3 + Db4` | C, D♭ | 13 | REJECT — minor ninth, unless the symbol names a ♭9 |

Both rows of each pair share an interval class. Collapsing them to "interval class 1"
would reject the maj7 that defines the chord and would treat a minor ninth as if it
were a semitone cluster. An implementation that bans a pitch class interval is
therefore forbidden.

## Contract

**Input** — the pitched notes of a generated performance (`chord`, `bass`, `top`;
drum voices carry percussion numbers and are excluded) plus the chords they sound
over, judged after the instrument effect has been applied. Sustain is what lengthens
gates into one another, so the notes that actually share air are only knowable there.

**Output** — a `HarmonyCollisionReport`. Detection only. Not one pitch is rewritten.

**Invariant** — pitch class is never changed to avoid a collision. Harmony stays as
written; the only admissible repair is octave displacement or omitting an optional
tone.

## Rules

### 1. Chord membership

Delegated to the existing harmony gate (`validateHarmony`), which resolves the
allowed set from the chord definition's own intervals. Only tones the symbol spells
are admitted, so the accompaniment layer cannot invent an extension:

| Symbol | Allowed pitch classes |
| --- | --- |
| `C` | C E G |
| `Cm7` | C E♭ G B♭ |
| `Cdim7` | C E♭ G♭ A |
| `Fmaj7` | F A C E |
| `Fmaj9` | F A C E G |

Delegation rather than reimplementation is deliberate: two independent membership
tests would eventually disagree, and a note would be legal for one layer and illegal
for the other.

### 2. Active note collision

Shared onsets are not what makes notes collide. A held bass under a syncopated upper
voice, a pedalled chord ringing into the next attack, an arpeggio whose gate exceeds
its step — none share a start time and all share the air. The overlap test is
`a.start < b.end && b.start < a.end`, and every overlapping pair is compared.

### 3–8. Pair rules

| Distance | Rule | Verdict |
| --- | --- | --- |
| 0 | `DUPLICATE_NOTE` | Merge to one note |
| 1 | `MINOR_SECOND` | REJECT (`cluster` mode excepted) |
| 2 | `MAJOR_SECOND` | REJECT below MIDI 60 unless the symbol names a 9th; otherwise ALLOW |
| 6 | `TRITONE` | ALLOW |
| 11 | `MAJOR_SEVENTH` | ALLOW |
| 12 | `OCTAVE` | ALLOW |
| 13 | `MINOR_NINTH` | REJECT unless the symbol declares the ♭9 |

The minor ninth exception is narrow: the upper note must be a ♭9 the chord names,
sitting a semitone above the note below it. `G7(♭9)` earns `G3 + Ab4`; a plain `C`
never earns `C3 + Db4`.

The tritone is classified rather than rejected because chord membership already
guarantees both notes belong to the chord. A dominant seventh, `m7♭5`, `dim`, `dim7`,
`♯11`, `♭5` and altered chords all need theirs.

### 9. Low interval limit

Two notes a fourth apart sit clean around middle C and turn to mud an octave and a
half below it. The requirement depends on the absolute register of the lower note:

| Lower note | Minimum span |
| --- | --- |
| below MIDI 36 (C2) | 12 semitones |
| below MIDI 48 (C3) | 7 semitones |

Unisons and octaves are excluded — doubling a pitch class is settled by the duplicate
and octave rules. The thresholds live in an `InstrumentCollisionProfile`, so a new
instrument ships a profile rather than a branch inside a rule, and they travel with
`octaveShift` because shifting the performance does not shift the instrument.

### 10. Duplicate MIDI note

Two note-ons for the same MIDI number in the same air are harmonically nothing — the
pitch was already there. They matter because the second retriggers the sampler, so the
first voice's envelope is cut and the pair reads as an accidental accent. Recorded as
`MERGE`, not as a harmonic error. `mergeDuplicateNotes` performs the merge; applying it
removes a note and therefore changes the audible output, so the caller decides when.

### 11. Auto correction

Correction is not post-hoc note surgery. The voicing engine already enumerates every
octave placement of every tone as a candidate, so the contract's ordered attempts —
raise the upper voice an octave, lower the lower voice an octave, omit an optional
tone — are already members of the candidate set. Enforcing the rules as a hard reject
inside a voicing policy therefore reaches the same result deterministically, with
harmony untouched.

The contract's final step, "reject the generation and regenerate", has no meaning
here: generation is deterministic, and the same input always yields the same output.
It is redefined as falling back to the least-bad surviving candidate.

### 12. Validation order

1. Chord membership
2. Instrument range
3. Duplicate note
4. Low interval limit
5. Minor second
6. Minor ninth
7. Conditional dissonance
8. Final active note set

The first verdict per pair wins, so a pair always reports a single reproducible
cause. This is why a semitone in the bottom octave is named `LOW_INTERVAL_LIMIT`
rather than `MINOR_SECOND` — both hold, and the order fixes which is recorded.

### 13. Debug log

Every reject records the chord symbol and root, the allowed pitch classes, both note
names and MIDI numbers, the interval, the lower note, the rule, the reason, the style,
the bar and the beat:

```
[HarmonyCollision]
Chord: Fmaj7
Root: F
Allowed: C E F A
Notes: E4 / F4
MIDI: 64 / 65
Interval: 1
Lower: 64
Rule: MINOR_SECOND
Reason: Close minor second — barred from ordinary accompaniment voicing.
Style: block.type1
Bar: 0
Beat: 0
Result: REJECT
```

## Modes

`normal` is the only mode production uses. The other two are the escape hatches the
contract reserves and does not yet implement, and nothing may bypass a rule without
naming one:

- `ornament` — will admit passing and approach tones outside the chord.
- `cluster` — will admit close minor seconds for a deliberate cluster voicing.

## Measured state of the shipping accompaniment

Golden Progressions A–I × every offered variant, piano, sustain:

| Variant | MINOR_SECOND | MAJOR_SECOND | DUPLICATE_NOTE |
| --- | --- | --- | --- |
| `block.type1` | 4 | 4 | 0 |
| `natural.type1` | 4 | 4 | 0 |
| `natural.type2` | 16 | 16 | 0 |
| `natural.type3` | 19 | 17 | 0 |
| `natural.type4` | 16 | 16 | 72 |
| `natural.type5` | 0 | 0 | 0 |
| `natural.dance1` | 20 | 23 | 36 |
| `city.type1` | 8 | 8 | 0 |

`NON_CHORD_TONE`, `INSTRUMENT_RANGE` and `LOW_INTERVAL_LIMIT` are zero everywhere and
are asserted at zero rather than pinned, so they are real gates today. `MINOR_NINTH`
is zero: the only minor ninths in the corpus are the ♭9 that `C7(♭9)` in Golden F
declares. Arpeggio (`natural.type5`) already passes the whole contract.

The user-approved 87-point output therefore does **not** pass the contract yet. The
87 close minor seconds are the same defect as the reported muddy `Cmaj7`, whose
approved voicing is `C3 G3 B3 C4 E4` — a B3–C4 semitone with a doubled root.

The candidate voicing policy `compact.v2` removes every one of those 87 and cuts
major seconds by roughly three quarters, which is independent confirmation that it
addresses the right defect. It is not enough on its own: it doubles the number of
minor ninths, and duplicate notes are a rhythm concern it never touches.

## Governance

Phase 1, recorded here, is detection only and changes no audible output — the release
baseline digests are byte-identical. Enforcement belongs to a future voicing policy
whose hard reject reuses these same rule functions, and cannot become the default
until real-device listening scores at least 87 and the Quality Ledger records it in
the same commit.

## Test gates

- `src/lib/performance/harmonyCollision/__tests__/harmonyCollisionValidator.test.ts`
  — the contract's own test list, plus the cases proving a verdict reads MIDI distance
  rather than interval class.
- `src/lib/performance/__tests__/harmonyCollisionDebt.test.ts` — the per-variant debt,
  a change detector in both directions. Regenerate with
  `WRITE_HARMONY_COLLISION_DEBT=1`, run prettier on the fixture, then rerun without
  the flag; the write pass compares against the file it just overwrote and is expected
  to fail.
