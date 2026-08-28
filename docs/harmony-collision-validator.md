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

Two note-ons for the same MIDI number **at the same instant** are harmonically
nothing — the pitch was already there. They matter because the second retriggers the
sampler, so the first voice's envelope is cut and the pair reads as an accidental
accent. Recorded as `MERGE`, not as a harmonic error.

The same instant is the whole rule. A pitch struck again at a later beat while the
first is still ringing is a re-articulation the rhythm asked for, and merging it would
silently delete an attack. Measured across the corpus, every same-pitch overlap the
accompaniment produces is of that second kind: there are no simultaneous duplicates at
all. `mergeDuplicateNotes` therefore stays available and tested but is not wired into
generation — if a real duplicate ever appears, the gate should fail loudly rather than
quietly remove a note.

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

Golden Progressions A–I × every offered variant, piano, sustain. **Every rule is zero
in every variant** since `compact.v3` was promoted on 2026-08-28. The contract is met,
not merely measured.

What v3 removed, recorded so the promotion is auditable — these were the counts under
`compact.v1`:

| Variant | MINOR_SECOND | MAJOR_SECOND |
| --- | --- | --- |
| `block.type1` | 4 | 4 |
| `natural.type1` | 4 | 4 |
| `natural.type2` | 16 | 16 |
| `natural.type3` | 19 | 17 |
| `natural.type4` | 16 | 16 |
| `natural.type5` | 0 | 0 |
| `natural.dance1` | 20 | 23 |
| `city.type1` | 8 | 8 |

The 87 close minor seconds were the same defect as the reported muddy `Cmaj7`, whose
v1 voicing was `C3 G3 B3 C4 E4` — a B3–C4 semitone with a doubled root.

`NON_CHORD_TONE`, `INSTRUMENT_RANGE`, `LOW_INTERVAL_LIMIT` and `DUPLICATE_NOTE` were
already zero under v1 and remain asserted at zero. `MINOR_NINTH` was zero under v1 too:
the only minor ninths in the corpus are the ♭9 that `C7(♭9)` in Golden F declares, which
the contract permits. Arpeggio (`natural.type5`) passed the whole contract before the
promotion and is unchanged by it.

## Why the enforcing policy is v3 and not v2

Rejects across the same corpus, by policy:

| Policy | Total | Breakdown |
| --- | --- | --- |
| `compact.v1` (shipped 1.0.2, superseded) | 175 | MINOR_SECOND 87, MAJOR_SECOND 88 |
| `compact.v2` (never promoted) | 23 | MINOR_NINTH 23 |
| `compact.v3` (shipping) | **0** | — |

`compact.v2` clears both defects the approved policy carries and then introduces one
the approved policy never had. The reason is mechanical: spreading a voicing to escape
a semitone lands the same two pitch classes an octave and a semitone apart, which is a
minor ninth. Judging only the semitone moves the problem instead of solving it, and
this is precisely the case a pitch-class-interval implementation cannot see — interval
class 1 covers both, so it would either reject the maj7 that defines the chord or
accept the mud.

`compact.v3` is `compact.v2` plus the collision gate, with every other judgement —
tone importance, spacing, missing-tone pricing, tension register, continuity, path
search — left identical. A listening comparison therefore isolates the gate rather
than confounding it with a second set of changes.

Enforcing the rules costs nothing musically: across all three inversions and the whole
corpus, every chord keeps every guide tone and every declared tension, holds at least
three notes, and stays inside the compact hand model.

## How correction works

There is no post-hoc note surgery. The engine already enumerates every octave
placement of every tone as a candidate, so the contract's ordered attempts — raise the
upper voice an octave, lower the bass an octave, omit an optional tone — exist as
siblings of the rejected candidate. Enforcing the rules as a rejection inside the
policy reaches the same result deterministically, and pitch class is never changed.

The rejection is priced at 100,000 rather than infinity: far above any soft cost or
continuity cost, so a clean voicing always wins, but finite, so a chord that cannot be
voiced cleanly inside the compact hand yields its least-bad voicing instead of failing
generation. That is what the contract's "reject and regenerate" step has to mean for an
engine where the same input always produces the same output.

## Governance

`compact.v3` scored 87–89/100 on device on 2026-08-28 and was promoted to the approved
default in the same commit as the digest refresh and the Quality Ledger entry, as the
rule requires. v1 and v2 stay registered with `listeningApproved: false` and remain
reachable through the admin-only dev listening screen, so the promotion is reversible by
ear and a future candidate has references to be judged against.

The refresh changed 33 of the 45 tracked digests. The other 12 — Golden A, B, D and I
across all three protected variants — are byte-identical, because those progressions had
no collision to fix. A promotion that rewrote everything would have been the signal that
the gate was doing more than it claimed.

The same governance now protects v3: it may only be replaced by a policy that earns its
own device listening pass at 87 or above.

## Test gates

- `harmonyCollision/__tests__/harmonyCollisionValidator.test.ts` — the contract's own
  test list, plus the cases proving a verdict reads MIDI distance rather than interval
  class.
- `__tests__/harmonyCollisionContract.test.ts` — every rule at zero in every shipping
  variant, read both from the per-variant counts and from the validator's own `ok`.
  Regenerate the fixture with `WRITE_HARMONY_COLLISION_DEBT=1`, run prettier on it, then
  rerun without the flag; the write pass compares against the file it just overwrote and
  is expected to fail.
- `__tests__/harmonyCollisionGate.test.ts` — that `compact.v3` reaches zero rejects,
  that v1 and v2 do not, and that reaching zero did not thin the harmony.
- `baseVoicing/policy/__tests__/compactV3Costs.test.ts` — rejection pricing and the
  agreement between policy and validator.
- `__tests__/voicingPolicyV3Candidate.test.ts` — the pinned shipping pitches, named
  rather than hashed. Regenerate with `WRITE_VOICING_V3_BASELINE=1`.

## Device audition

Completed 2026-08-28 at 87–89/100 on a development build, comparing `compact.v1` against
`compact.v3` through the admin-only listening screen's **Shared Base Voicing** selector.
The reported muddy `Cmaj7` was resolved.

To repeat the comparison, or to audition a future candidate against v3: Block Type1
sounds the full Shared Base and is the clearest place to hear a voicing difference.
Chords worth comparing are `Cmaj7`, `Fmaj7` in first inversion, and Golden F's
`Gm9 | C7(♭9) | Am7 | Dm7` for the ♭9 exception.
