# Chord Palette Preference Score v0

Offline preference pipeline. **Production Realizer is unchanged. No Release.**

PopVoicingScore v0 is **not** used for ranking. Blind listening on C|Am|F|G was:

| | Order |
|---|---|
| Human | X > Y > Z |
| POP909 score | Y > X > Z |

Z was worst on both sides. POP909 stays as an **outlier rejector**, not a “closer to median = better” ranker.

## Goal

Predict accompaniments that Chord Palette listeners prefer — not accompaniments that are common in POP909.

## Architecture

```
Candidate
  → Hard Gate
  → POP909 Outlier Rejector
  → ChordPalettePreferenceScore
  → Final ranking
```

POP909 score is never added into the ranking total.

### Hard Gate (absolute)

- User chord legality = 100%
- Identical simultaneous MIDI duplicate = 0
- Invalid voice crossing = 0
- Slash bass contract (explicit slash only; inversions allowed otherwise)
- Playback pitch mismatch = 0 (device). Offline pack checks MIDI range 0–127
- CC64 loss = 0 (device). Offline pack writes CC64 on/off into the SMF

### POP909 role

Warning / reject on extreme tails only:

- register (center and Δ)
- span
- bass leap
- top leap
- total voice movement

Do not reward sitting near the median.

## Features (recorded, not weighted)

commonToneRate, totalVoiceMovement, meanVoiceMovement, bassMovement, topMovement, registerCenterDelta, spanDelta, inversion (root-position rate), rootPositionResetRate, voiceCountChange, teacherSpacingSimilarity, teacherTopContourSimilarity, teacherBassContourSimilarity, extensionPlacement (low-register rate), attackDensity.

Teacher similarities are `null` until a teacher take is attached. Offline factory voicings have no teacher.

Continuity to watch: register, bass, top, chord-to-chord voice movement.

## Do not hand-tune yet

The first X/Y/Z set is 3 pairs. That is not enough for production weights.

## Data collection

```bash
npm run preference:collect
```

Writes `LocalAnalysis/accompaniment_quality_dataset/round1/`:

| Path | Who opens it |
|---|---|
| `midi/{A-E}/{P-T}.mid` | Listener |
| `worksheets/{A-E}.json` | Listener (ranking + 0–100 scores) |
| `_analyst/KEY_DO_NOT_SHOW.json` | After listening only |

Progressions:

- A: C | Am | F | G
- B: D | Bm | G | A
- C: Cmaj7 | Am7 | Fmaj7 | G7
- D: C | G/B | Am | F
- E: C | Cadd9 | Cmaj7 | C7

Five offline styles per progression (not from the production realizer). Labels P–T are shuffled per progression.

## Labels

Per progression: ranking (e.g. `Q > S > P > T > R`) plus Overall / Voicing / Voice Leading / Register / Naturalness (0–100). Comment optional.

Ranking expands to pairwise rows (`B > D`, `B > A`, …).

## Analysis

```bash
npm run preference:analyze
```

At 20–30 pairs: preferred vs rejected feature means. No logistic / boosting until that threshold.

Success later: leave-one-progression-out beats POP909 pair accuracy, especially **X > Y** (smooth connection vs common root reset).

## Production

Unchanged. Preference Score must pass a new blind listening test before it may rank candidates. POP909 is kept as a rejector only.
