# Chord Palette v1.0.1 — Current Quality Status

Updated: 2026-08-17  
Branch: `quality/autonomous-pdca`  
Evidence rule: only confirmed code reachability, automated output, and real-device results may change a status to PASS.

## Release status

**NOT READY**

User listening baseline: **87/100** after the neutral-register and short-chord
Natural corrections.

The September release is blocked by the missing voicing selector. Short Natural
chords, style-dependent Production voicing, register listening, and first-play
reliability are no longer release blockers.

## First Playback

**PASS — MANUAL 10/10 PROCESS RESTARTS / DIAGNOSTIC CAPTURE 2/2**

Reproduction:

- Fresh launch
- `F | G | Em | Am`
- Natural Type1
- Drum OFF
- Loop ON
- Four-count is heard, but the first accompaniment does not flow correctly
- After changing Loop to OFF and restarting from the top, playback is correct

Static audit found a high-confidence cold-start candidate:

- `prepare()` attaches the realtime sampler but does not load its melodic program.
- The count-in sampler is loaded during prepare.
- The realtime piano loads the 148MB GM SoundFont synchronously only after count-in completion.
- The second play is warm because `RealtimeSamplerEngine` caches instrument/program.

This matched the first-only shape. The pre-fix handoff/load delay was not captured,
so the precise historical causal timing remains high-confidence rather than directly
measured.

PHASE 1 candidate:

- Realtime piano is warmed during native `prepare()`.
- Every sequencer request preflights its selected instrument before count-in starts.
- `playRealtime()` repeats the same preflight idempotently as a safety guard.
- JS `play` waits behind a shared prepare barrier.
- Stop/teardown invalidate a play queued behind cold preparation.
- A repeated `prepare()` no longer changes a live native transport from `playing` to `ready`.
- Diagnostics now timestamp realtime load start/end, count-in plan signature, and first chord NoteOn.

Observed device evidence:

- User-observed true process restart matrix: **10/10 PASS**.
- Metro captured two independent cold processes from that final check: **2/2 PASS**.
- 07:49 process: `countIn.handoff` → first chord NoteOn in **2 ms**.
- 07:52 process: `countIn.handoff` → first chord NoteOn in **3 ms**.
- Both captures used Sequencer, preflight was cached at handoff, Drum OFF, Loop ON,
  and all 16 CC64 messages reached the sampler.

## Harmony

**PASS for canonical Golden A–I**

- Illegal pitch class: 0
- Automatic extension: 0
- Harmony gate detects but never snaps
- Teacher/POP harmony leakage in public paths: 0 observed

Permanent gate: `src/lib/performance/__tests__/accompanimentQualityContract.test.ts`.

September additions `F | G | Em | Am`, `Fmaj7 | G7 | Em7 | Am7`, and
`Cdim | Caug | F | G` are now part of the permanent corpus.

## Voicing

**AUTOMATED PASS / REAL-DEVICE LISTENING PENDING**

Production now has one style-neutral Base Voicing Source of Truth:

1. `progressionToPerfChords()` resolves harmony once through `baseVoicing/`.
2. Block strikes the resolved `bassMidi/bodyMidi`.
3. Natural applies Teacher-derived attack-group timing/dynamics and subtractive
   masks to that same Base; Teacher pitch structure is not read.
4. City applies Candidate B masks to that same Base.

The former City voicer was deleted. The historical `progressionToChordSpecs()`
and Teacher-pitch realizers are deprecated analysis paths, not shipping session
playback.

Measured Production result:

- New style-neutral `baseVoicing/` domain module
- LH exactly 1 note; RH 2–4 notes; total 4–5 in the measured corpus
- `基本形 / 1st / 2nd` input semantics implemented
- Global continuity optimization includes the loop boundary
- Golden A–I × 3 positions = 108 candidate voicings
- Compact failures 0, illegal notes 0, duplicate MIDI 0, inversion failures 0
- Block/Natural/City exact Base equality 36/36

## Register

**AUTOMATED PASS / DEVICE RE-LISTENING PENDING**

- Block/Natural/City use the same register policy and exact Base pitches.
- `octaveShift` reaches all three Production styles.
- Tier is excluded from Base Voicing generation.
- Device listening found that the obsolete `+1 octave` product default made all
  three styles unnaturally high after Shared Base promotion. The default is now
  neutral `0`: LH C2–C3 / RH C3–C5.
- The preference key is versioned to `octave_shift_v2`, preventing existing
  installs from restoring the retired automatic `+1`; a future explicit `+1`
  choice remains supported.
- Register preference, Production Shared Base, and permanent quality gates:
  **52/52 PASS**. Full regression: **114 suites / 2124 passed / 1 skipped /
  0 failed**.
- Maximum bass jump is 10 semitones and maximum top jump is 3 semitones,
  including the loop boundary.

## Style Pitch Invariance

**PASS — 36/36 PRODUCTION CHORDS**

Historical Production baseline: **0/36 chords** on Golden A–I.

Promoted Production result: **36/36 chords**, with bass equality 36/36, top
equality 36/36, and maximum cross-style pitch spread 0 semitones.

The former `it.failing` contract is now a normal permanent passing test.

## Natural Groove

**IMPROVED, NOT CONVERGED**

Kept experiment `gate-01`:

- Synthetic sustain duration stretch removed
- Ring is CC64-only
- Sounding ratio improved from 1.000 to 0.708
- Double-sustain cases improved from 6 to 0

Known issue: written Natural gates still overlap the following attack in 13/31 measured transitions.

## City

**VARIATION CHILD / DOWNBEAT FIX IMPLEMENTED**

City Type1 uses accepted Candidate B semantics:

- Short stabs
- Controlled subtraction
- Real silence between attacks
- No micro-roll default

After `gate-01`, rest rate returned from 0.65 to 1.00 and overlapping attacks from 8 to 0. City still owns a separate voicing engine, so style invariance fails.

Device listening found a repeated laid-back phase at the City downbeat. Audit confirmed
that all six attacks retained the source recording's fixed four-tick delay:
`+0.008333 beat` (5 ms at BPM 100). The independent City renderer applies no later
humanization, so the offset repeated exactly every cycle.

Kept candidate `city-downbeat-01`:

- Production onsets are grid-aligned to `0, 0.5, 0.75, 1.25, 1.75, 2.0`.
- Inter-onset intervals, gate, velocity, masks, pitches and rests are unchanged.
- The measured four-tick source delay remains metadata, not production timing.

City is no longer presented as a top-level style. The selector now shows Block,
Natural, and Variation. Variation contains City only.

Persisted City identity remains `city / city.type1`; existing projects require no
migration and still use the independent Candidate B renderer.

## Playback Fidelity

**APP / VIDEO FIDELITY PASS**

- Shipping engine: `sequencer`
- Final MIDI → native uses one flattened NoteOn/NoteOff/CC64 schedule
- Playback CC64 count equals Final MIDI CC64 count in the existing audit
- No sampled-path pitch clamp in shipping playback

Device listening exposed a separate export mismatch:

- App Natural used Final MIDI → `AVAudioUnitSampler` with 16 CC64 messages.
- Video audio sent only legacy `chordEvents` to `SampledInstrumentProvider`.
- The video request had no CC field, so Natural lost **16/16 CC64**.
- Video also rendered at 44.1 kHz through pre-rendered note buffers while the observed
  app engine ran at 48 kHz through the live sampler.

Kept implementation:

- `buildVideoAudioRequest()` now derives video audio from the canonical Final MIDI.
- Offline native rendering receives the exact realtime NoteOn/NoteOff/CC schedule,
  GM program and plan signature.
- New `OfflineMidiRenderer` uses `AVAudioUnitSampler`, the canonical GM SoundFont,
  same-pitch NoteOff protection and sample-boundary event dispatch.
- The old chord-event renderer remains only as a compatibility fallback.
- Block, Natural and City payload equality plus Natural CC64 preservation are permanent tests.

Mitigated in PHASE 1:

- Realtime sampler cold-load moved before count-in.
- JS prepare/play/stop/teardown now use a testable lifecycle coordinator.
- A live transport survives repeated screen-mount prepare calls.
- Eight automated lifecycle scenarios cover fresh Loop ON/OFF, Stop→Play,
  Loop toggles, Natural→Block→Natural, progression replacement, and stop during
  cold prepare.

Open risk:

- Swift compilation passed in the internal EAS development build.
- Required 10-run true fresh-state matrix still requires the provisioned iPhone.
- The new offline MIDI renderer compiled in EAS build
  `bb2b826f-c312-44e6-b145-b32559ea7e6f`; device A/B passed.

## Voicing UI

**ENGINE SEMANTICS READY / SESSION, SAVE AND UI NOT IMPLEMENTED**

No `基本形 / 1st / 2nd` selection exists in `EditorSession`, project persistence, or device preferences. The only current register control is `octaveShift`.

Shared engine semantics now exist for `基本形 / 1st / 2nd` and the engine is
promoted to Production. Wiring the preference through Session, persistence, and
UI is the next implementation phase.

## Dim / Aug

**SHARED VOICING POC PASS / END-TO-END PARTIAL**

`CHORD_CATALOG` already defines:

- `dim`: `[0, 3, 6]`
- `aug`: `[0, 4, 8]`

Shared voicing, compactness, altered-fifth preservation, and all 12 transpositions
pass in the PoC. UI reachability, Production playback, save/reload, and export
remain unproven.

## Hard Gates

| Gate | Status |
|---|---|
| Harmony legality | PASS on canonical A–I |
| Unauthorized pitch classes | PASS on canonical A–I |
| Passing notes | PASS for public Block/Natural/Variation providers; legacy saved rhythms remain reachable |
| Automatic extension | PASS on canonical A–I |
| Duplicate simultaneous pitch | PASS |
| MIDI range 0–127 | PASS |
| Slash bass | PASS |
| CC64 loss | PASS in existing audit |
| City silence | PASS |
| Style Base Voicing equality | PASS — Production 36/36; historical baseline 0/36 |
| Compact 3–5 voice default | PASS — 108/108 |
| Invalid crossing | PASS — 108/108 |
| Unexplained octave reset | PASS — max bass 10 / top 3 semitones incl. loop |
| First-play JS lifecycle matrix | PASS (8 tests) |
| First-play native Swift compile | PASS — EAS build `aa03b2a7-b1d2-48b1-b481-01e0f1bbcc7b` |
| First-play cold diagnostic capture | PASS 2/2; handoff → NoteOn 2–3 ms |
| First-play real-device reliability | PASS — manual 10/10 process restarts |
| Video Final MIDI payload equality | PASS — Block/Natural/City, 5 tests |
| Video Natural CC64 loss | PASS at JS/native payload boundary: 16/16 → 0 loss |
| Video offline Swift compile | PASS — EAS build `bb2b826f-c312-44e6-b145-b32559ea7e6f` |
| Video real-device A/B | PASS |
| City production downbeat phase | PASS — fixed source delay removed |
| City Variation grouping | PASS — storage identity preserved |
| Mixed 1/2- and 1/4-bar Block/City | PASS — 90/132 BPM |
| Mixed 1/2- and 1/4-bar Natural | PASS — duration-aware uncompressed prefix |
| Short Natural pedal boundary | PASS — CC64 is up at every short chord boundary |

## Known Blockers

1. **P1** Voicing selection UI/persistence absent.
2. **P2** Natural has 5/31 next-attack overlaps in the full-bar Golden observation.
3. **P2** Legacy saved rhythms can reach passing/approach bass logic.

## Next Action

Wire `基本形 / 1st / 2nd` through Session, project persistence, and the Editor
UI.

## User Action Required

Re-listen to a progression combining 1- and 2-beat chords when convenient.
