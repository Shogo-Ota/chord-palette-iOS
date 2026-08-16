# Groove Preference Round1

Offline blind-listening experiment. **Production Realizer, Production ranking and Release are unchanged.**

## Goal

Measure preference for time-domain performance structure while holding harmony and voicing constant.

## Fixed conditions

- Progression and chord duration
- ConnectedStable pitch pool per chord
- Voicing, inversion, register, bass and top pitch
- Piano, 70 BPM, Drum OFF
- Release Cut OFF
- Teacher CC64 bars 1–4 repeated for all candidates

Candidates may change onset, attack pattern, density, rest, duration, velocity contour,
timing–velocity relation and phrase structure. They may only reuse pitches from the
fixed chord voicing.

## Production separation

All logic lives under `src/lib/groovePreference/` and `scripts/groovePreference/`.
It does not import or call `humanTemplate/realize.ts`, `PerformanceEngine`, or a
Production ranking path. The generic Final MIDI snapshot type and SMF writer are only
used to encode offline listening files.

## Teacher evidence

Base timeline: real Natural take `P1_A3`, 70 BPM.

The shipped Teacher JSON files declare eight source bars, but all 18 files expose
note attacks for musical bars 1–4 only. Bars 5–8 note attacks were therefore **not
invented**.

For `PHRASE_VARIATION`, the second four-bar phrase uses the real approved Variation
take `P1_C12`. Teacher pitch is never read. Voice role / voicing position is mapped
deterministically into the fixed connectedStable pitch pool. Extra attacks reuse that
same pool.

## Candidate Strategies

1. `TEACHER_TIMELINE_REPEAT`
   - `P1_A3` bars 1–4 repeated as bars 5–8.
2. `QUANTIZED_CONTROL`
   - Same timeline moved to the nearest eighth-note grid.
   - Duration and velocity are not regenerated.
3. `SIMPLIFIED_DENSITY`
   - Keeps first, whole-beat and stronger Teacher attacks.
   - Removed attacks do not extend surviving note durations.
4. `PHRASE_VARIATION`
   - `P1_A3` first phrase + real `P1_C12` Variation phrase.
5. `BROKEN_CONTROL`
   - Rotates the existing velocity multiset by one note event.
   - Onset count, pitch, duration, mean velocity, velocity variance and range remain unchanged.
   - Only timing–velocity assignment is disrupted; no extreme random corruption.

No candidate uses random humanization.

## Progressions

- A: C | Am | F | G
- B: Cmaj7 | Am7 | Fmaj7 | G7
- C: C | G/B | Am | F

Each progression repeats for eight bars.

## Feature schema

The generated `feature_schema.json` describes:

- attack groups, density, rest and beat-position histogram
- offbeat ratio and syncopation
- IOI distribution and variation
- grid deviation mean / standard deviation / pattern
- velocity distribution / contour / accent positions
- timing–velocity correlation
- duration and articulation
- CC64 coverage
- phrase repetition similarity / variation amount

Features and candidate types are written only under `_analyst/`.

## Generate

```bash
npm run groove:collect
```

Output:

```text
LocalAnalysis/accompaniment_quality_dataset/groove_round1/
├── midi/{A-C}/{P-T}.mid
├── worksheets/{A-C}.json
├── pairs.json
├── feature_schema.json
├── analysis/
└── _analyst/KEY_DO_NOT_SHOW.json
```

## Blind listening

Do not open `_analyst/` before saving labels.

For every progression, rank P–T and fill Overall / Groove / Naturalness /
ForwardMotion / RhythmFeel (0–100). Ranking is the primary label.

After all three rankings:

```bash
npm run groove:analyze
```

Three rankings produce 30 pair rows, but only three independent progression groups.
Round1 reports preferred/rejected feature differences and cross-progression direction.
It creates no Groove Score or Production weight.
