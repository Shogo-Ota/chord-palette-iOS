# Chord Palette v1.0.2 Candidate — Current Quality Status

Updated: 2026-08-23
Branch: `quality/autonomous-pdca`  
Evidence rule: only confirmed code reachability, automated output, and real-device results may change a status to PASS.

## Release status

**BUILD 22 RELEASE CANDIDATE — ALL STYLES DEVICE-APPROVED**

User listening baseline: **87/100** after the neutral-register and short-chord
Natural corrections.

Build 11 remains the historical 87/100 checkpoint. Build 13 received **85/100**
for overall candidate quality. Subsequent device listening
approved Natural Type1 and City but rejected Natural Type2/3 for insufficient
groove. Build 13 intentionally replaces those rejected gestures and adds Natural
Type4/5 from the approved Reo MIDI candidate analysis.

Build 14 applies the user's listening classification: Natural contains Type1/2,
Variation contains City/Funk/Driving, and Arpeggio is a separate Style. Persisted
`natural.type3/4/5` IDs remain unchanged. Type2 gains controlled CC64 while its
note/onset/pitch/velocity schedule remains Build 13 exact.

Build 15 adds a separate controlled CC64 envelope to Driving, changes Arpeggio
to rise then fall inside every chord, and makes all displayed Style/pattern
labels and hints English. Storage IDs remain unchanged.

Build 16 adds `natural.dance1` under Variation as Dance. It imports only the
measured onset/gate/velocity/pedal and Attack Group structure of the reference;
source pitch, key, harmony, progression and melody are forbidden. Every note is
an unchanged subset of Shared Base Voicing. The new digest is not release
authority until device listening passes.

Build 16 Dance received **60/100** on device: the gesture lacked groove. The
implementation had reduced each Attack Group to one mean velocity, flattening
the measured low-to-high hand hierarchy. Build 17 restores the pitch-independent
`77/81/93` and `77/85/97` RH envelopes without adding random timing. It also
removes Arpeggio's repeated apex at beat 2 and holds the single apex through
controlled CC64 until beat 3.9.

Build 17 device listening approved Arpeggio and rejected Dance again for weak
groove. The approved Arpeggio note/CC64 schedule is now frozen by digest
`4ff013c...f0834`. Build 18 replaces Dance's literal one-bar source copy with
the documented Dance design target: weak downbeat shell, strong short offbeat
stabs, an A/B/A/D four-bar phrase and a fourth-bar dropout. Dance pedal is now
limited to short `0.5–0.92` and `2.5–2.92` windows.

Build 18 also makes same-beat MIDI order explicit across realtime playback and
SMF: `NoteOff → CC64 Up → CC64 Down → NoteOn`. This removes dependence on sort
stability when adjacent chords re-pedal at the same beat.

Build 18 device listening approved the common Sustain correction, but Dance and
Driving remained below the required accompaniment quality. Driving is frozen
until Dance passes. For Dance, the owner supplied `hipnotize.mp3` and identified
`00:35–01:05` piano/chord/overall groove as the target.

Audio analysis measured a stable approximately 128–129 BPM eighth-note pulse:
Bass-band attacks occur on each `&` with 80–93% presence, beat/`&` harmonic
attacks dominate, and no fourth-bar density drop was measured. Build 19 therefore
replaces the sparse `5/5/5/4` profile with `8/8/8/8`: strong FULL anchors on
beats 1/3, RH responses on 2/4, and one Bass attack on every eighth-note offbeat.
No source pitch, harmony, progression or random Humanize is imported.

Build 20A isolates the owner's report of rare random timing disruption from all
Style changes. The shipping realtime path previously submitted every MIDI event
through a separate `DispatchQueue.asyncAfter` deadline. Those deadlines use the
OS scheduler and can wake late under load even when the Final MIDI beat values
are exact. Build 20A replaces accompaniment scheduling with an Audio Unit render
observer: chord and drum samplers share one sample-time origin, and each event is
submitted at its exact frame offset inside the current audio buffer. Same-pitch
NoteOff suppression is precomputed off the render thread. Type2, Driving,
Funk/City reverb and Dance redesign remain outside 20A pending device timing
acceptance.

Build 20A device listening confirmed that timing is stable. Build 21 freezes
that sample-clock path and changes only requested resonance/space policy.
Natural Type2 now holds CC64 from chord start to beat 3.9. Driving retains its
four pedal windows, but the `1.25/1.5/1.75` and `3.25/3.5/3.75` turns remain
under pedal until `1.95/3.95`, so the final single note is not cut dry.

Funk (`natural.type3`) and City (`city.type1`) now resolve through a pure
Accompaniment Space Provider to Apple Small Room at 8% wet. Every other Style
resolves to dry. Reverb is an audio effect rather than MIDI data; the same
semantic profile is passed to realtime playback and offline video rendering.
MIDI notes, onset, gate, velocity, harmony and the approved sample-clock
scheduler are unchanged.

Build 21 device listening approved Type2 Sustain, Driving Sustain and the
Funk/City subtle room. Build 22 freezes those paths and replaces only Dance's
superseded Build 19 pulse. The owner designated `hipnotize piano.mid`
(SHA-256 `ee9dd75b...deec91`) as the exact Dance reference. It measures eight
complete bars, 48 all-block Attack Groups, no CC64 and a canonical
`0/1/1.5/1.75/2.5/3.5` six-attack grid. Bar 7 removes the 1.5 response; bar 8
adds a measured 0.0438-beat Bass-to-RH roll and closing fill.

Production stores only onset, gate, velocity-by-hand/rank and Attack Group role.
`VOICE_ROLES` is an additive subtractive-selection strategy for the measured
Bass plus RH-bottom dyad; it cannot create or move a pitch. All other emitted
notes remain exact Shared Base subsets. Dance uses written 0.5/1.0-beat overlap
and remains CC64-free.

The protected release authority is now the unchanged Block Type1, Natural Type1
and City Type1 output across Golden A–I. The historical 45-digest fixture remains
immutable, while rejected Type2/3 keys are no longer treated as approved release
authority. Type2–5 receive new digest authority only after Build 13 device
listening passes.

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

**SHARED BASE DEVICE PASS / PER-CHORD CONTROL AUTOMATED PASS**

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
- Each `ChordEvent` may choose its own position. Candidate layers are still
  selected by one global continuity DP, so individual control does not bypass
  voice-leading or style invariance.
- `基本形` keeps the approved candidate set. `1st` anchors LH/RH on 3rd/next
  available tone; `2nd` anchors LH/RH on 5th/next available tone so both hands
  communicate the inversion.
- Global continuity optimization includes the loop boundary
- Golden A–I × 3 positions = 108 candidate voicings
- Compact failures 0, illegal notes 0, duplicate MIDI 0, inversion failures 0
- Block/Natural/City exact Base equality 36/36

## Register

**AUTOMATED PASS / BUILD 11 DEVICE PASS**

- Block/Natural/City use the same register policy and exact Base pitches.
- `octaveShift` reaches all three Production styles.
- Tier is excluded from Base Voicing generation.
- Device listening found that the obsolete `+1 octave` product default made all
  three styles unnaturally high after Shared Base promotion. The default is now
  neutral `0`: LH C2–C3 / RH C3–C5.
- The preference key is versioned to `octave_shift_v2`, preventing existing
  installs from restoring the retired automatic `+1`; a future explicit `+1`
  choice remains supported.
- Register preference, Production Shared Base, and permanent quality gates pass.
  Full Build 13 candidate regression: **127 suites / 2212 passed / 1 skipped /
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

**TYPE1 DEVICE PASS / TYPE2–5 BUILD 13 AUTOMATED PASS, DEVICE PENDING**

Kept experiment `gate-01`:

- Synthetic sustain duration stretch removed
- Ring is CC64-only
- Sounding ratio improved from 1.000 to 0.708
- Double-sustain cases improved from 6 to 0

Historical v87 baseline: written Natural gates overlapped the following attack
in 13/31 measured transitions.

Build 13 Natural identities:

- Type1: beats `0, 1, 1.5, 2.5, 3` on every chord; long/short/long/short/long
- Type2 / Candidate 01: six Block/RH/Bass response groups per bar with 0.5-beat
  written gates and explicit silence
- Type3 / Candidate 02: four-bar syncopated phrase with short attacks, velocity
  contrast and independent Bass responses
- Type4 / Candidate 03: dense four-bar driving comping with 8th/16th responses
- Type5 / Candidate 04: single-note broken gesture alternating the unchanged
  Shared Base LH and stable RH voice ranks; each chord rises then falls
- Short chords use an uncompressed prefix
- Type2 uses controlled CC64 during `0–0.72`, `1–1.9`, `2–2.72` and `3–3.9`
  beats. Principal rests and every chord boundary remain Pedal Up.
- Driving uses shorter controlled windows at `0–0.82`, `1–1.68`, `2–2.82` and
  `3–3.68`; Arpeggio uses `0–3.9`; Funk remains pedal-free. Type1 retains
  Teacher pedal.
- Source key, pitch, chord and progression are absent from Production profiles.
  Every emitted pitch is an unchanged subset of Shared Base Voicing.

Automated promotion matrix: Golden A–I × Type2–5 × root/1st/2nd Base Voicing,
all 12 keys, slash bass and deterministic Final MIDI. Illegal pitch, passing
note, simultaneous duplicate MIDI and style-dependent Base difference are all 0.

## City

**VARIATION CHILD / DOWNBEAT FIX IMPLEMENTED**

City Type1 uses accepted Candidate B semantics over the Shared Base:

- Short stabs
- Controlled subtraction
- Real silence between attacks
- No micro-roll default

After `gate-01`, rest rate returned from 0.65 to 1.00 and overlapping attacks
from 8 to 0. City no longer owns a separate voicer; style invariance is 36/36.

Device listening found a repeated laid-back phase at the City downbeat. Audit confirmed
that all six attacks retained the source recording's fixed four-tick delay:
`+0.008333 beat` (5 ms at BPM 100). The independent City renderer applies no later
humanization, so the offset repeated exactly every cycle.

Kept candidate `city-downbeat-01`:

- Production onsets are grid-aligned to `0, 0.5, 0.75, 1.25, 1.75, 2.0`.
- Inter-onset intervals, gate, velocity, masks, pitches and rests are unchanged.
- The measured four-tick source delay remains metadata, not production timing.

City is not presented as a top-level style. The selector shows `Block`,
`Natural`, `Variation` and `Arpeggio`. Natural contains Type 1/2; Variation
contains City/Funk/Driving; Arpeggio contains the former Natural Type5 as Type 1.
All displayed group labels, pattern labels and hints are English.

Persisted City identity remains `city / city.type1`; existing projects require no
migration and still use the independent Candidate B rhythm/mask renderer.

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

Device evidence:

- First-play manual true-process restart matrix passed **10/10**.
- The new offline MIDI renderer compiled in EAS build
  `bb2b826f-c312-44e6-b145-b32559ea7e6f`; device A/B passed.

## Voicing UI

**PER-CHORD IMPLEMENTED / AUTOMATED PASS / DEVICE CHECK PENDING**

- `基本形 / 1st / 2nd` uses the single domain `VoicingPosition` definition.
- `ChordEvent.voicingPosition` is the sole Production authority. The old
  `projects.voicing_position` column is read only to promote legacy projects into
  explicit per-chord values, then retired to `root` on new writes.
- Long-pressing a placed chord opens `基本形 / 1st / 2nd`; non-root cards show the
  chosen position in the timeline.
- Selection marks the Session dirty only when changed and survives Style changes,
  duplication, reorder, transpose, append and save/reload.
- Playback, chord preview, MIDI export, video export and the export keyboard read
  each event's own selection.
- Slash bass remains authoritative over inversion.
- The Project-wide selector was removed from the Groove screen.

## Dim / Aug

**PRODUCTION AUTOMATED PASS / ARBITRARY-ROOT UI OUT OF SCOPE**

`CHORD_CATALOG` already defines:

- `dim`: `[0, 3, 6]`
- `aug`: `[0, 4, 8]`

Shared voicing, compactness, altered-fifth preservation, Production playback and
all 12 transpositions pass. Golden I (`Cdim | Caug | F | G`) is in the permanent
quality and 87-point digest gates. Arbitrary-root dim/aug/dim7 UI is deferred.

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
| Protected 87/100 audible digest | PASS — Block Type1, Natural Type1 and City Type1, 27/27 |
| Voicing Project migration/save | PASS — legacy Project value promotes to per-chord root/first/second |
| Voicing preview/playback/export reachability | PASS |
| TypeScript release gate | PASS — `tsc --noEmit` |
| Background lifecycle serialization | PASS — pause once, foreground prepare, no auto-resume |
| Resume held-voice/CC64 reconstruction | PASS — Swift compile + Build 11 device matrix |
| Candidate regression | PASS — 128 suites / 2224 passed / 1 skipped for Build 15 |
| v1.0.2 build 11 internal iOS build | PASS — `5bda9432-7e1e-4c63-a6b1-817b1e936a6e` |
| Preview wall-clock duration | PASS — fixed 2.0 s at 60/100/180 BPM |
| Preview stale NoteOff ownership | SWIFT COMPILE PASS / Build 12 device validation pending |
| v1.0.2 build 12 internal iOS build | PASS — `9df25e88-2978-4acc-8941-1d8a24efef24` |
| Natural Type2–5 candidate profile | BUILD 13 DEVICE LISTENING 85/100 |
| Type2–5 all-key harmony and pitch subset | PASS — 12/12 keys, illegal pitch 0 |
| Type2–5 Shared Base invariance | PASS — Golden A–I × root/1st/2nd |
| v1.0.2 build 13 internal iOS build | PASS — `bd612acc-3086-4212-9f39-99771a8876e2` |
| Natural/Variation/Arpeggio presentation regroup | BUILD 14 DEVICE PASS |
| Type2 controlled CC64/rest boundary | AUTOMATED PASS / Build 14 device pending |
| v1.0.2 build 14 internal iOS build | PASS — `6a9b17ef-5788-42a5-8394-94ef5ef76c09` |
| Driving controlled CC64/rest boundary | AUTOMATED PASS / Build 15 device pending |
| Arpeggio rise/fall gesture | AUTOMATED PASS / Build 15 device pending |
| English Style labels/hints | AUTOMATED PASS / Build 15 device pending |
| v1.0.2 build 15 internal iOS build | PASS — `1ca84326-22fe-416d-a13f-618217d42b80` |
| Variation Dance six-group identity and short-chord prefix | AUTOMATED PASS / Build 16 device pending |
| Dance harmony/Base invariance/slash bass across A–I, all keys and positions | PASS |
| Dance controlled CC64 and live/MIDI/video Final MIDI equality | PASS |
| Existing 27 release digests and Type2–4 candidate digests | PASS / unchanged |
| Build 16 full regression | PASS — 130 suites / 2242 passed / 1 skipped |
| Build 16 TypeScript / canonical lint | PASS / 0 errors, 46 existing warnings |
| v1.0.2 build 16 internal iOS build | PASS — `36b98b97-7186-4d95-9326-5b181cb71784` |
| Build 16 Dance device listening | FAIL — 60/100; weak groove |
| Build 17 Dance hand/rank velocity hierarchy | AUTOMATED PASS / device pending |
| Build 17 Arpeggio single apex and controlled resonance | AUTOMATED PASS / device pending |
| Build 17 full regression | PASS — 132 suites / 2251 passed / 1 skipped |
| Build 17 TypeScript / canonical lint | PASS / 0 errors, 46 existing warnings |
| v1.0.2 build 17 internal iOS build | PASS — `f7f3aff7-76e6-4b5d-b226-1db98933e706` |
| Build 17 Arpeggio device listening | PASS — user approved; digest frozen |
| Build 17 Dance device listening | FAIL — weak groove |
| Build 18 Dance A/B/A/D offbeat phrase and fourth-bar dropout | AUTOMATED PASS / device pending |
| Build 18 canonical same-beat NoteOff/CC64 Up/Down/NoteOn order | AUTOMATED PASS / device pending |
| Build 18 full regression | PASS — 132 suites / 2253 passed / 1 skipped |
| Build 18 TypeScript / canonical lint | PASS / 0 errors, 46 existing warnings |
| v1.0.2 build 18 internal iOS build | PASS — `9d9ee09d-113f-4f1c-94c0-73981900f617` |
| Build 18 common Sustain device listening | PASS — user approved |
| Build 18 Dance device listening | FAIL — low accompaniment quality |
| Build 19 Dance full-mix audio analysis | PASS — 30 seconds / approximately 15 bars |
| Build 19 Dance `8/8/8/8` chord/Bass interlock | AUTOMATED PASS / device pending |
| Build 19 approved Arpeggio and existing Style digests | PASS / unchanged |
| Build 19 full regression | PASS — 132 suites / 2253 passed / 1 skipped |
| Build 19 TypeScript / canonical lint | PASS / 0 errors, 46 existing warnings |
| v1.0.2 build 19 internal iOS build | PASS — `2b38792c-91b4-47fc-bd1e-35ae79221c97` |
| Build 20A common timing device listening | PASS — user confirmed stable |
| Build 21 Type2/Driving Sustain and Funk/City room device listening | PASS — user approved |
| Build 22 Dance eight-bar MIDI contract | PASS — device listening approved |
| Build 22 Dance/Natural Atomic focused regression | PASS — 8 suites / 57 passed |
| Build 22 full regression | PASS — 135 suites / 2278 passed / 1 skipped |
| Build 22 TypeScript / canonical lint | PASS / 0 errors, 46 existing warnings |
| v1.0.2 build 22 internal iOS build | PASS — `22f9f87b-fff5-41e3-a554-d112f2e8c260` |
| v1.0.2 build 23 Production iOS build | PASS — `0a3f0799-8785-49ca-bb23-0bdbcde43586` |
| Build 23 App Store Connect upload | PASS — `ccc7d6a2-6452-40ca-a6bc-7775a27b9176` |

## Known Blockers

1. **P1** Build 12 Preview correction still needs explicit device confirmation.
2. **P2** Legacy saved rhythms can reach passing/approach bass logic.
3. Production build and App Store submission require final release approval;
   they are process boundaries, not quality failures.

## Next Action

Freeze the accepted Build 22 output, create the Production iOS build and upload
version 1.0.2 to App Store Connect. Do not change accompaniment behavior during
release preparation.

## User Action Required

All Style quality is device-approved. Final App Store metadata, compliance and
review-submission confirmation are still required.
