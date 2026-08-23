# Chord Palette 1.0.2 Internal Candidate

Updated: 2026-08-23  
Version/build: `1.0.2 (23)`  
Branch: `quality/autonomous-pdca`  
Internal build: https://expo.dev/accounts/shogoota/projects/chord-palette/builds/22f9f87b-fff5-41e3-a554-d112f2e8c260
Production build: https://expo.dev/accounts/shogoota/projects/chord-palette/builds/0a3f0799-8785-49ca-bb23-0bdbcde43586

Build 11 is the device-approved 87/100 accompaniment authority. Build 12 changes
only chord-card Preview lifetime/ownership; it must leave all 45 accompaniment
digests exact.

Build 13 keeps the approved Block Type1, Natural Type1 and City Type1 digests
exact. It intentionally replaces rejected Natural Type2/3 and adds Type4/5 from
the accepted Reo MIDI candidate groups.

## Automated evidence

- [x] Approved Block/City digest remains exact: 18/18
- [x] Build 11 device-approved digest is frozen: 45/45
- [x] Build 11 changed exactly Natural Type1/2: 18 keys; remaining 27/27 exact
- [x] Harmony, passing-note, duplicate, slash-bass, register and CC64 gates
- [x] Shared Base style equality: 36/36
- [x] Root / 1st / 2nd semantics and all 12 transpositions
- [x] Legacy Project position → per-chord migration/default/explicit tests
- [x] Per-chord preview, playback, MIDI and video position reachability
- [x] Mixed 1/2- and 1/4-bar chord matrix
- [x] TypeScript (`tsc --noEmit`)
- [x] AppState pause/prepare serialization tests
- [x] Full Build 15 Jest: 128 suites / 2224 passed / 1 skipped
- [x] TypeScript and canonical lint (0 errors / 46 existing warnings)
- [x] Build 11 internal EAS iOS build and Swift compile
- [x] Preview duration is 2.0 wall-clock seconds at 60/100/180 BPM
- [x] Old-native fallback beats resolve to the same 2.0 seconds
- [x] Preview generation compiles in Build 12 and invalidates stale NoteOffs
- [x] Natural Type2–5 use Shared Base Voicing subsets only
- [x] Golden A–I × Type2–5 × root/1st/2nd Base Voicing invariance
- [x] Natural Type2–5 harmony legality and MIDI range across all 12 keys
- [x] Type5 emits exactly one unchanged Base note per Attack Group
- [x] Type2–5 use uncompressed prefixes on 0.25/0.5/1/2-beat inputs
- [x] Type2 controlled CC64 leaves principal rests and every chord boundary Pedal Up
- [x] Type3 remains pedal-free; Type1 retains Teacher pedal
- [x] Type2–4 Build 13 note/onset/pitch/velocity digests unchanged
- [x] Natural/Variation/Arpeggio regroup preserves every storage ID
- [x] Block Type1, Natural Type1 and City Type1 protected digests unchanged
- [x] Build 13 internal EAS iOS build and Swift compile
- [x] Build 14 internal EAS iOS build and Swift compile
- [x] Driving controlled CC64 leaves every chord boundary Pedal Up
- [x] Arpeggio is one-note-per-attack and rises then falls inside every chord
- [x] Style groups, pattern labels and displayed hints are English
- [x] Build 15 internal EAS iOS build and Swift compile
- [x] Dance profile stores no source pitch/key/chord/progression/melody
- [x] Dance emits six Attack Groups at `0, 0.5, 1.5, 2, 2.25, 3`
- [x] Dance uses Shared Base subsets only across Golden A–I and all 12 keys
- [x] Dance root/1st/2nd, slash bass, range, crossing and duplicate MIDI gates
- [x] Dance uses uncompressed 1/2/full-bar prefixes
- [x] Dance controlled CC64 is Up at 3.85 and every chord boundary
- [x] Dance `releaseCut` is pedal-free and video/MIDI use canonical Final MIDI
- [x] Existing release and Natural candidate digests remain unchanged
- [x] Full Build 16 Jest: 130 suites / 2242 passed / 1 skipped
- [x] Build 16 TypeScript and canonical lint (0 errors / 46 existing warnings)
- [x] Build 16 internal EAS iOS build and Swift compile
- [x] Build 16 Dance device result recorded as 60/100 and rejected
- [x] Dance restores measured pitch-independent RH/LH velocity hierarchy
- [x] Arpeggio apex sounds once; beat 2 is a controlled-resonance rest
- [x] Arpeggio CC64 is Up at 3.9 and every chord boundary
- [x] Arpeggio `releaseCut` is pedal-free and video/MIDI use canonical Final MIDI
- [x] Full Build 17 Jest: 132 suites / 2251 passed / 1 skipped
- [x] Build 17 TypeScript and canonical lint (0 errors / 46 existing warnings)
- [x] Build 17 internal EAS iOS build and Swift compile
- [x] Build 17 Arpeggio device listening approved
- [x] Build 17 approved Arpeggio schedule frozen as `4ff013c...f0834`
- [x] Build 17 Dance device listening rejected for weak groove
- [x] Dance uses A/B/A/D offbeat stabs with a fourth-bar dropout
- [x] Dance pedal is limited to `0.5–0.92` and `2.5–2.92`
- [x] Same-beat order is `NoteOff → CC64 Up → CC64 Down → NoteOn`
- [x] Full Build 18 Jest: 132 suites / 2253 passed / 1 skipped
- [x] Build 18 TypeScript and canonical lint (0 errors / 46 existing warnings)
- [x] Build 18 internal EAS iOS build and Swift compile
- [x] Build 18 common Sustain device listening approved
- [x] Dance reference audio `00:35–01:05` analyzed
- [x] Dance emits eight alternating chord/Bass attacks in every full bar
- [x] Every `.5` offbeat is one Shared Base Bass note
- [x] Approved Arpeggio and existing Style digests remain exact
- [x] Full Build 19 Jest: 132 suites / 2253 passed / 1 skipped
- [x] Build 19 TypeScript and canonical lint (0 errors / 46 existing warnings)
- [x] Build 19 internal EAS iOS build and Swift compile
- [x] Realtime accompaniment no longer uses event-level `DispatchQueue.asyncAfter`
- [x] Chord and drum samplers share one Audio Unit sample-time origin
- [x] Same-pitch NoteOff suppression is precomputed off the render callback
- [x] Native sample-clock source contract and canonical MIDI order: 19/19
- [x] Full Build 20A Jest: 133 suites / 2257 passed / 1 skipped
- [x] Build 20A TypeScript and canonical lint (0 errors / 46 existing warnings)
- [x] Build 20 internal EAS iOS build and Swift compile
- [x] Build 20A device listening: common timing stable
- [x] Type2 uses one `0–3.9` long-pedal window per full chord
- [x] Driving turn windows remain down through `1.75/3.75` and rise at `1.95/3.95`
- [x] Funk/City resolve to Small Room at exactly 8%; all other Styles remain dry
- [x] Live and offline video carry the same room profile
- [x] Build 21 focused Sustain/Room gates: 53/53
- [x] Full Build 21 Jest: 135 suites / 2274 passed / 1 skipped
- [x] Build 21 TypeScript and canonical lint (0 errors / 46 existing warnings)
- [x] Build 21 internal EAS iOS build and Swift compile
- [x] Build 21 device listening approved Type2, Driving, Funk and City
- [x] Dance reference MIDI SHA-256 is frozen as `ee9dd75b...deec91`
- [x] Dance eight-bar unique Attack Group counts are `6/6/6/6/6/6/5/7`
- [x] Dance uses only Shared Base masks/roles, including subtractive Bass+RH-bottom
- [x] Dance preserves measured 0.5/1.0-beat gates and remains CC64-free
- [x] Dance bar 8 preserves the 0.0438-beat Bass-to-RH terminal roll
- [x] Build 22 Dance/Natural Atomic focused gates: 8 suites / 57 passed
- [x] Full Build 22 Jest: 135 suites / 2278 passed / 1 skipped
- [x] Build 22 TypeScript and canonical lint (0 errors / 46 existing warnings)
- [x] Build 22 internal EAS iOS build and Swift compile
- [x] Build 23 Production EAS iOS build and signing

## Build 13 Natural Type2–5 listening matrix

User result: **85/100**. Type3 was approved as Funk/Variation; Type5 was
identified as Arpeggio. Type2 needs controlled Sustain to sound more Natural.

- [ ] Natural Type2: Block/RH/Bass response has clear forward groove and real rests
- [ ] Natural Type3: short syncopation and Bass responses feel human, not mechanical
- [ ] Natural Type4: dense pattern has drive without becoming heavy or muddy
- [ ] Natural Type5: single-note broken gesture stays chord-locked and natural
- [ ] Type1 remains identical to the approved Build 12 sound
- [ ] Variation/City remains identical to the approved Build 12 sound
- [ ] `基本形 / 1st / 2nd` changes pitch identically across Type1–5
- [ ] `C | G/B | Am | F` preserves slash bass in Type2–5
- [ ] 1-beat and 2-beat chords change harmony cleanly without compressed gestures
- [ ] Exported video matches in-app Type2–5 timing, gates and pedal state

## Build 14 regroup and Sustain matrix

- [ ] Top-level groups are Block / Natural / Variation / Arpeggio in a 2×2 layout
- [ ] Natural contains Type1 and Type2 only
- [ ] Variation contains City / Funk / Driving
- [ ] Arpeggio is independent and plays the former Type5 gesture
- [ ] Existing saved Type3/4/5 projects reopen under the correct new group
- [ ] Type2 sounds more Natural with controlled Sustain
- [ ] Type2 still exposes clear rests before beats 1 and 3
- [ ] Type2 changes harmony cleanly on 1-beat and 2-beat chords
- [ ] `releaseCut` removes Type2 pedal
- [ ] Video/MIDI export matches in-app Type2 CC64

## Build 15 Sustain, Arpeggio and English UI matrix

- [ ] Style shows Block / Natural / Variation / Arpeggio in English
- [ ] Natural shows Type 1 / Type 2 with English hints
- [ ] Variation shows City / Funk / Driving with English hints
- [ ] Type2 Sustain sounds natural without erasing its rests
- [ ] Driving Sustain adds body without blurring the 16th-note groove
- [ ] Arpeggio rises during beats 0–2 and falls during beats 2–4
- [ ] Arpeggio remains single-note and uses only the selected chord tones
- [ ] 1-beat and 2-beat chord changes release Type2/Driving pedal cleanly
- [ ] Video/MIDI export matches in-app Type2/Driving CC64

## Build 16 Variation Dance matrix

- [ ] Variation shows City / Funk / Driving / Dance in a 2×2 chip layout
- [ ] Dance has six clear attacks at `0, 0.5, 1.5, 2, 2.25, 3`
- [ ] The offbeat/full attack feels dance-like rather than mechanically repeated
- [ ] Long resonance adds body without blurring the next chord
- [ ] `F | G | Em | Am` changes harmony cleanly
- [ ] `C | G/B | Am | F` preserves B as slash bass in the full attack
- [ ] 1-beat and 2-beat chords use the opening prefix without time compression
- [ ] `基本形 / 1st / 2nd` changes the same Shared Base as other Styles
- [ ] Save, force-quit and reopen restores Variation / Dance
- [ ] Video/MIDI export matches in-app Dance timing, gate and CC64
- [ ] Block, Natural Type1, City, Funk, Driving and Arpeggio are unchanged

Build 16 result: **60/100 / rejected**. Dance lacked groove because simultaneous
notes were flattened to one Attack Group mean velocity.

## Build 17 Dance velocity and Arpeggio resonance matrix

- [x] Arpeggio highest note sounds exactly once at beat 1.5
- [x] Beat 2 has no re-attack; the apex decays naturally until descent at beat 2.5
- [x] Arpeggio pedal adds resonance without blurring the next chord
- [x] Arpeggio approved by the user
- [ ] Dance top notes speak clearly above lower RH notes without sounding harsh
- [ ] Dance beat 0.5 full attack has weight from LH and definition from RH top
- [x] Dance rejected again for weak groove
- [ ] Video/MIDI export matches in-app Dance velocity and Arpeggio CC64
- [ ] Block, Natural Type1, City, Funk and Driving remain unchanged

## Build 18 Dance phrase and Sustain reliability matrix

- [ ] Dance has a quiet beat-0 shell and strong short stabs on `.5` offbeats
- [ ] Dance rests remain audible instead of being filled by long pedal wash
- [ ] Bars 1–3 repeat coherently; bar 4 drops the `3.5` pickup
- [ ] Dance feels propulsive with Drum OFF at 110, 120 and 130 BPM
- [ ] `F | G | Em | Am` and `C | G/B | Am | F` change harmony cleanly
- [ ] 1-beat and 2-beat chords retain an uncompressed phrase prefix
- [ ] Repeat each pedaled Style for 10 loops without a random Sustain cut
- [ ] Pause/resume each pedaled Style 10 times without a random Sustain cut
- [ ] Loop boundary re-pedals cleanly without a gap or previous-chord blur
- [ ] MIDI/video output matches the in-app CC64 boundary order
- [ ] Approved Arpeggio remains identical to digest `4ff013c...f0834`

Build 18 result: common Sustain **approved**. Dance and Driving accompaniment
quality remain below target.

## Build 19 measured Dance pulse matrix

Use `F | G | Em | Am`, 120 BPM, Piano, Drum OFF.

Superseded by the owner-designated Build 22 MIDI reference; do not use this
matrix for release approval.

- [ ] Beat 1 begins with a confident full chord rather than a weak shell
- [ ] Bass is clearly heard on `.5 / 1.5 / 2.5 / 3.5`
- [ ] Beats 2 and 4 answer with shorter right-hand chords
- [ ] Chord and Bass alternate as one continuous eighth-note pulse
- [ ] The groove moves forward without sounding rigid or hurried
- [ ] All four bars retain stable density; no fourth-bar energy collapse
- [ ] Chord changes remain clean on `F | G | Em | Am`
- [ ] At 110 and 130 BPM the same role alternation remains coherent
- [ ] With Drum ON, offbeat Bass does not overcrowd kick or clap
- [ ] Common Sustain remains approved and Arpeggio remains unchanged

## Build 20A sample-clock timing matrix

Use `F | G | Em | Am`, 120 BPM, Piano, Loop ON.

- [ ] Drum OFF: listen through 20 loops without a late/early chord attack
- [ ] Drum ON: chord and drum transients stay locked through 20 loops
- [ ] Repeat at 90 and 150 BPM; no random timing displacement
- [ ] Pause/resume 10 times; resumed notes and the next attack remain in time
- [ ] Change Style and Piano/E.Piano during playback; no one-buffer shift
- [ ] Background/foreground 10 times and resume without timing displacement
- [ ] Diagnostics report `scheduler = audio-render-clock`
- [ ] Diagnostics report `sampleClockAvailable = true`
- [ ] `sampleClockLateEvents = 0` after the matrix
- [ ] Type2, Driving, Funk, City and Dance sound unchanged in Build 20A

Build 20A result: **PASS — common timing is stable**.

## Build 21 Sustain and Room matrix

Use `F | G | Em | Am`, 120 BPM, Piano, Drum OFF.

- [x] Natural Type2 has clearly stronger continuous resonance
- [x] Type2 releases cleanly before every chord change
- [x] Driving's `タラ` final single notes at `1.75/3.75` no longer sound dry or cheap
- [x] Driving's short turns remain articulated rather than becoming blurred
- [x] Funk has subtle room depth without sounding distant
- [x] City has subtle room depth without losing its intentional rests
- [x] Funk and City are both 8% wet; neither is audibly over-reverberated
- [x] Block, Natural Type1, Arpeggio, Driving and Dance remain dry
- [ ] Video export matches the in-app Funk/City room
- [ ] Build 20A timing remains stable through 20 loops

Build 21 result: **PASS — user approved all four requested Style changes**.

## Build 22 Dance MIDI-reference matrix

Use `F | G | Em | Am | F | G | Em | Am`, 120 BPM, Piano, Drum OFF.

- [ ] Bars 1–6 have six clear attacks at `0 / 1 / 1.5 / 1.75 / 2.5 / 3.5`
- [ ] Beat 1.5 has a low two-voice response rather than Build 19's single Bass pulse
- [ ] 0.5/1.0-beat overlap gives body without any sustain-pedal wash
- [ ] Bar 7 omits the beat-1.5 response and creates an audible phrase dropout
- [ ] Bar 8 opens with a short Bass-to-RH roll rather than a timing glitch
- [ ] Bar 8 closes with the beat-3 low/full layer and beat-3.5 RH accent
- [ ] Looping returns from bar 8 to bar 1 without a duplicate or missing attack
- [ ] Dance remains dry; Funk/City keep their approved 8% room
- [ ] The same phrase remains coherent at 110 and 130 BPM
- [ ] MIDI/video export matches in-app onset, gate and velocity
- [ ] Type2, Driving, Funk, City and approved Arpeggio remain unchanged

Build 22 result: **PASS — the owner approved all Style quality for release**.
Unchecked rows remain final release-operation checks rather than accompaniment
quality blockers.

## iPhone release matrix

Use `F | G | Em | Am`, Natural Type1, Drum OFF, Loop ON unless a row says
otherwise.

- [ ] Fresh launch: count-in → first chord flows correctly
- [ ] Long-press chord 1/2/3 and assign `基本形 / 1st / 2nd`; each card shows its choice
- [ ] Mixed per-chord positions sound distinct without octave jumps or muddy 7ths
- [ ] Groove screen no longer shows a Project-wide Voicing selector
- [ ] Save, force-quit and reopen restores every chord's own position
- [ ] Block → Natural → Variation/City preserves each chord's Base pitch
- [ ] `C | G/B | Am | F` keeps B as slash bass regardless of that chord's selector
- [ ] Natural Type1 clearly plays long/short/long/short/long at `0,1,1.5,2.5,3`
- [ ] Natural Type2 clearly plays chord/RH/Bass responses at `0,1,1.5,2,3,3.5`
- [ ] Natural Type2 controlled pedal does not blur its principal rests
- [ ] Variation Funk and Driving retain their Build 13 note schedules
- [ ] Arpeggio Type1 remains a single-note broken gesture
- [ ] Mixed 1/2- and 1/4-bar Natural sounds uncompressed and changes harmony cleanly
- [ ] While Natural is sounding, background the app mid-chord, return and press Play:
      the full chord/bass resumes, never a single note
- [ ] Repeat background → foreground → resume 10 times with Loop ON
- [ ] Repeat resume once with Piano and once with E.Piano
- [ ] MIDI/video export reflects mixed per-chord positions and new Type1/2 timing
- [ ] Candidate default is not worse than 87/100

## Build 12 Preview matrix

- [ ] One chord selection rings for about two seconds and ends naturally
- [ ] Rapidly select chords with shared tones; no tone disappears mid-preview
- [ ] Repeat at 60 and 180 BPM; audition duration remains the same
- [ ] Start accompaniment immediately after Preview; no delayed Preview NoteOff
      cuts the accompaniment
- [ ] Build 11 accompaniment authority remains exact: 45/45

## Promotion rule

Do not promote if any item above fails, if any approved digest moves, or if
Harmony, CC64, first-play or resume reliability regresses. Production build,
App Store submission and the post-device commit require explicit approval.
