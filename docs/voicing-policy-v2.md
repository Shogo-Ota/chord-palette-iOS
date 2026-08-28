# Voicing Policy v2 — Specification

Updated: 2026-08-28
Branch: `cursor/voicing-policy-v2-33d6`
Status: **`compact.v3` is the shipped default (87–89/100, promoted 2026-08-28). `compact.v2`
was never promoted; `compact.v1` is the superseded 1.0.2 baseline. Both stay registered as
comparison references.**

This document specifies the policy contract and the v2 cost model. `compact.v3` is that
model plus the collision gate, specified in `docs/harmony-collision-validator.md`; read
both to understand what ships. Section 7 records how the promotion actually went.

## 1. What a Voicing Policy is

A Voicing Policy decides which pitches the Shared Base Voicing holds for one
chord, and how those pitches connect across a progression. It is the single
place where "this chord sounds muddy" or "this inversion is unplayable" can be
answered.

It is deliberately **not** the place where rhythm, dynamics or Style live. Every
Style receives the identical Shared Base and may only subtract from it.

| Concern | Owner |
| --- | --- |
| Legal pitch classes of a chord | `theory/definitions/catalog` → `chordHarmonyFromEvent` |
| Enumerating legal hand shapes | `CompactVoicingEngine` |
| Which tones to keep, what a cluster costs, how the path is chosen | **Voicing Policy** |
| Register windows and the two-hand model | `handModel` |
| Onset / gate / velocity / masks | Style + Rhythm profiles |

## 2. Contract

### Input

- `rootPc`, `chordIntervals`, `slashBassPc`
- `position` — `root` / `first` / `second`, per chord
- `octaveShift` — whole-register shift in octaves
- the whole progression, because voice leading and loop closure are global

### Output

- exactly one left-hand note
- two to four right-hand notes
- per note: pitch, pitch class, interval, degree, hand, bass flag, duplicate flag
- per candidate: a static cost, so selection is inspectable

### Invariants — all policies

1. No pitch outside the chord's legal set. Slash bass is the only added tone.
2. Slash bass overrides the inversion preference.
3. Identical output for every Style and every tier. Style may only subtract.
4. `octaveShift` transposes the entire result; it never reshapes it.
5. One left-hand note; two to four right-hand notes; three to five notes total.
6. Left hand 36–48, right hand 48–72 at `octaveShift 0`; minimum hand gap 5.
7. No duplicated MIDI pitch inside one voicing.
8. Selection is global across the progression, including the loop-closing
   transition back to chord 1.
9. Fully deterministic: ties resolve on a stable candidate key, never on
   iteration order.

Gated by `CompactVoicingEngine.test.ts` for **both** policies, across Golden
A–I, all three positions and all twelve transpositions.

## 3. Tone importance

When the four-note right-hand limit forces an omission, tones are ranked by
interval role — never by chord symbol.

1. 3rd
2. 7th
3. Altered 5th (defines diminished / augmented)
4. Altered tension (♭9, ♯9, ♯11, ♭13)
5. The **topmost** natural extension (the 13th of a 13th chord)
6. Root
7. Lower natural extensions
8. Perfect 5th

The root ranks below the colors because the left hand usually already holds it.

## 4. `compact.v1` — superseded, still frozen

The Shared Base the owner approved by ear at 87/100 (build 1.0.2 (11), device
listening 2026-08-20). Shipped 1.0.2; replaced as the default by `compact.v3` on
2026-08-28.

- One tone family: the most complete four-note right hand.
- Inversion anchor is a **hard filter**: the right hand must start on the chord
  tone above the requested bass.
- Cost = register placement + 14 per narrow pair below E3 + a linear penalty for
  any 7th or extension below F3.
- Voice leading weighs 1.0.
- Path search restarts the lattice from every first-chord candidate.

`compactV1Policy.ts` stays frozen — including the order in which costs accumulate,
because floating-point accumulation order is part of the historical result. It is no
longer what ships, but it is the reference every A/B on the listening screen is judged
against, so retuning it would silently invalidate every past judgement.

Known limits, documented rather than patched — and precisely what v3 exists to fix:
low-register minor seconds are merely expensive instead of rejected, and the hard anchor
can force a cluster in an inversion.

## 5. `compact.v2` — never promoted

### 5.1 Musical intent

Never delete a legal tension to clear muddiness — move it or spread it.

### 5.2 Rejection

Exactly one hard reject: a right-hand minor second whose lower note is below
E3 (`LOW_CLUSTER_HARD_CEILING = 52`, shifted by `octaveShift`). Everything else
is priced, so no chord can become unrenderable.

### 5.3 Costs

| Term | Behaviour |
| --- | --- |
| Register placement | Distance from the neutral compact shape. Shared with v1. |
| Minor second | Graded by register: 44 → 10 from the bottom to the top of the RH window. Tension pairs 26 → 6. |
| Major second | 22% of the structural minor second. |
| Cluster density | 4 notes inside a tritone: 18. Inside a major sixth: 8. |
| Thinness | 3 per missing note when the chord has 4 or fewer tones. |
| Tension register | 1.5/semitone below F3, 2.4/semitone below A♯3 for altered tensions. |
| Missing tone | Guide tone 90, altered tension 95, identity extension 95, lower extension 24, root 28, perfect 5th 1.5. |
| Bass/RH root duplication | 11 when the chord has 5+ tones, otherwise 2. |
| Inversion anchor miss | 9 — priced, not filtered. |

Because a missing guide tone (90) or tension (95) costs far more than any
cluster (≤ 44), the cheapest way out of muddiness is always to respace.

### 5.4 Missing tones are priced interval by interval

A role-set check cannot see that a 13th chord lost its 13th while it still holds
a 9th. v2 therefore evaluates every available interval on its own, and treats
the topmost natural extension as the chord's identity:

- C13 without the 13th → 95
- C13 without the 9th → 24

### 5.5 Additional tone families

Beyond the most complete right hand, v2 also offers: the same hand without a
root the bass already holds, the same hand minus each support tone, and the
guide-tone-only hand. A packed close voicing becomes one option instead of the
only one.

### 5.6 Continuity

Voice leading weighs 0.72, so static quality is not sacrificed to movement. Path
search is a single forward pass that carries each surviving path's start index,
keeping loop closure exact.

### 5.7 Measured effect

Golden progressions and the V1–V9 corpus, all three positions
(`docs/performance/reports/voicing-policy-v2/before-after.json`):

- 25 of 30 corpus voicings change.
- `C7(♭9)` root: `C2 E3 B♭3 C4 D♭4` → `C2 G3 B♭3 D♭4 E4` — the C/D♭ semitone in
  the low-mid right hand is gone, the ♭9 stays.
- `Fmaj7` first inversion: `A2 C4 E4 F4 A4` → `A2 F3 A3 C4 E4` — the E/F
  semitone is gone.
- `C13` root: `C2 A3 B♭3 D4 E4` → `C2 B♭3 D4 E4 A4` — the 13th sits on top
  instead of a semitone under the 7th.
- 16-chord resolution: 143.3 ms → 82.2 ms.

## 6. Architecture

```
baseVoicing/
├── CompactVoicingEngine.ts     enumeration only, policy-parameterised
├── continuity.ts               voice-movement measurement (policy-neutral)
├── handModel.ts                register windows, two-hand legality
└── policy/
    ├── types.ts                the policy contract
    ├── intervalRoles.ts        interval vocabulary
    ├── toneImportance.ts       tone ranking and tone families
    ├── registerPlacement.ts    shared register cost
    ├── pathSearch.ts           two progression-wide search strategies
    ├── compactV2Costs.ts       v2 spacing / dissonance / required tones
    ├── compactV1Policy.ts      approved policy (frozen)
    ├── compactV2Policy.ts      candidate policy
    └── registry.ts             provider — resolves the active policy
```

A new musical opinion is a new file implementing `VoicingPolicySpec` plus a
registry entry. The engine does not change.

## 7. Governance

`registry.ts` resolves the active policy for every caller — playback, MIDI
export, video render. Its default is `APPROVED_VOICING_POLICY_ID`, so an
unapproved voicing cannot ship by accident. A non-default policy is reachable only
through `setVoicingPolicyOverride`, which the admin-only dev listening screen
uses to A/B by ear inside one build.

Promotion requires, in order:

1. Device listening on the dev build, the current default heard first as the reference.
2. A score of at least 87/100 across all shipped Styles.
3. `APPROVED_VOICING_POLICY_ID` and the two `listeningApproved` flags changed together.
4. `releaseAccompanimentBaselineV87` digests refreshed **in the same commit** as
   a Quality Ledger note recording the new listening score and date.

Until step 2 passes, the approved digests must not be touched. Refreshing them
to match a candidate would make the regression suite green while silently
discarding the only evidence that the shipped sound was ever approved.

### How the v3 promotion went, 2026-08-28

`compact.v3` scored 87–89/100 and replaced `compact.v1`. `compact.v2` was skipped: it
cleared v1's semitones but introduced 23 minor ninths, so it was never a shipping
candidate — it survives only as the record of why the gate had to judge MIDI distance
rather than interval class.

The whole promotion was three registry values. No engine, Style, Energy, rhythm or
product UI file changed, which is the concrete payoff of this policy contract: a change
to what every chord sounds like did not require touching anything that decides when
chords sound.

Of 45 tracked digests, 33 changed. The 12 that did not — Golden A, B, D and I across all
three protected variants — had no collision to fix, so v3 reproduces v1 exactly there.
Base tones per chord fell from 4.417 to 4.222, because resolving a semitone sometimes
means omitting a perfect 5th rather than keeping the clash; guide tones, declared
tensions, the three-note floor and the compact hand model all held.

## 8. Test gates

| Gate | Scope |
| --- | --- |
| `releaseAccompanimentBaselineV87` | Shipping audible output, byte-exact. Now pins v3; keeps v1's record under `supersedes`. |
| `CompactVoicingEngine.test.ts` | Structural invariants, all three policies, 12 keys × 3 positions. |
| `voicingQuality.test.ts` | V1–V9 corpus claims, v2 only. |
| `compactV2Costs.test.ts` | Cost model unit behaviour, including interval-level required tones. |
| `compactV3Costs.test.ts` | Rejection pricing, and that v2's soft scoring survives underneath v3. |
| `voicingPolicyRegistry.test.ts` | An unapproved policy can never be the default; overrides are reversible and actually move pitch. |
| `voicingPolicyV3Candidate.test.ts` | Shipping Shared Base pitches, readable MIDI rather than a hash. |
| `voicingPolicyV2Candidate.test.ts` | v2's pitches, kept as the never-promoted reference. |
| `harmonyCollisionContract.test.ts` | Every collision rule at zero in all 8 shipping variants. |
| `sharedBaseVoicingProduction.test.ts` | Style invariance and per-chord inversion on the production path. |

Refresh the candidate checkpoint after an intentional v2 change. The write pass
fails by design, because it compares against the fixture it has just replaced:

```bash
WRITE_VOICING_CANDIDATE_BASELINE=1 npx jest voicingPolicyV2Candidate
npx prettier --write src/lib/performance/__tests__/fixtures/voicingPolicyV2Candidate.json
npx jest voicingPolicyV2Candidate
```

Regenerate the approved-vs-candidate comparison dump:

```bash
npm run quality:voicingPolicyV2
```

## 9. Device audition — COMPLETE for v3

`compact.v3` was auditioned against `compact.v1` on 2026-08-28 and scored 87–89/100. The
reported muddy `Cmaj7` was resolved. `compact.v2` was never auditioned on its own; the
measured minor ninths ruled it out before it reached a device.

To audition a future candidate against v3:

1. Home → **v1.01 実機リスニング（Human MIDI）** (dev builds only).
2. **Shared Base Voicing（A/B）** → the shipping policy, play, and keep it as the
   reference.
3. Switch to the candidate and replay the same Case. Style, rhythm, dynamics and pedal
   are identical; only the chord pitches move.
4. Repeat per Case and per Style, and report a score relative to the reference.

What to listen for, from the measured differences:

- `C7(♭9)` and `C7(♭13)`: the low-mid semitone rub should be gone without the
  altered color thinning out.
- `Fmaj7` first inversion: the E/F rub should be gone.
- `C13`: the 13th on top should read as color, not as a clash under the 7th.
- Anything that got **worse**: a voicing that now sounds thin, too open, or that
  lost weight in the left hand. v3 holds 4.222 base tones per chord against v1's 4.417,
  so thinning is the specific risk a candidate in this family has to be checked for.

The override is diagnostic and resets on app restart, so an audition can never leak into
a release.

## 10. Open questions

1. **Does v2 sound better on a device?** Unknown until the audition. All evidence
   so far is structural and measured, not perceptual.
2. **Voice leading weight.** 0.72 was chosen so static quality wins ties; it has
   not been swept.
3. **Per-Style policy.** Deliberately out of scope: the Shared Base contract
   requires Style invariance. A Style-dependent voicing would need that contract
   revised first.
