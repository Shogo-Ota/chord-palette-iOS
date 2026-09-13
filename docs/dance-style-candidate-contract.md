# Variation Dance Candidate Contract

Status: Builds 16–19 rejected/superseded; Build 22 MIDI-reference candidate  
Primary reference: `LocalDatasets/CommercialSongMidi/Dance/hipnotize piano.mid`  
Reference SHA-256: `ee9dd75bef8054e79c703fca8ed7205fc509988f45ae475aa10b886945deec91`  
Decision date: 2026-08-23

## MEASURED

- Tempo: 120 BPM
- Meter: 4/4
- Note channel: one piano channel
- Length: 8 complete bars
- Notes / Attack Groups: 167 / 48
- Attack density: 1.5 groups per beat / 6.0 groups per bar
- Simultaneous-note ratio / block tendency: 1.0 / 1.0
- Canonical bars 1–6: `0, 1, 1.5, 1.75, 2.5, 3.5`
- Bar 7 dropout: `0, 1, 1.75, 2.5, 3.5`
- Bar 8 roll/fill: `0, 0.0438, 1, 1.75, 2.5, 3, 3.5`
- Median Attack Group gate: 0.5 beat
- Gate quartiles: 0.5 / 1.0 beat; mean 0.7433 beat
- Key-sounding ratio: 0.9684 from written gates and overlap
- Velocity: mean 84.56, standard deviation 7.59, P10–P90 77–97
- Canonical RH rank envelopes: `77/81/93`, `77/85/97`, `80/77/97/81`
- Bass-note ratio: 0.1677
- CC64 events / Pedal Down ratio: 0 / 0
- Near-roll events: 2; the production candidate retains only the measured
  terminal Bass-to-RH roll at 0.0438 beat

## BUILD 19 AUDIO MEASURED

Build 19 used the owner-provided full-mix `hipnotize.mp3` interval at
`00:35–01:05`:

- Analyzed range: 30 seconds / approximately 15 complete bars
- Estimated tempo: 127.6–129.2 BPM
- Harmonic Attack Groups: 135
- Harmonic median inter-onset interval: 0.232 seconds, approximately one eighth note
- Harmonic Attack Groups on beat / `&`: 57 / 44
- Overall `&` mean onset strength: 4.053; beat mean: 3.592
- Bass-band `&` presence by beat: 80–93%
- Harmonic grid error: median 17.4 ms; P90 absolute 23.2 ms
- Ten-second harmonic density: 42 / 46 / 47; no measured fourth-bar density drop

That evidence produced an eight-note chord/Bass interlock, but the owner later
designated the exact piano MIDI above as the Dance reference. Build 22 therefore
supersedes Build 19 rather than blending incompatible densities.

## REO FUNK INTERSECTION

The six-position grid `0 / 1 / 1.5 / 1.75 / 2.5 / 3.5` occurs as a subset of
the measured Reo Funk corpus. Both sources use block Attack Groups, contrasting
0.5/1.0-beat gates and non-flat velocity. The eight-bar dropout and terminal
roll/fill, plus the absence of independent single-note pulse throughout bars
1–7, distinguish this candidate from the current UI Funk profile.

## Production profile

- Persisted playback identity: `natural / natural.dance1`
- Presentation: `Variation / Dance`
- Eight-bar phrase: six canonical bars, one dropout bar, one roll/fill bar
- Bars 1–6 selection:
  `FULL / RIGHT_HAND / (BASS + RH_BOTTOM) / RIGHT_HAND / RIGHT_HAND / RIGHT_HAND`
- Bars 1–6 gates: `1 / 0.5 / 1 / 0.5 / 1 / 0.5`
- Bar 7 removes the `1.5` Bass/RH-bottom response
- Bar 8 opens `BASS@0 → RIGHT_HAND@0.0438` and closes with split-gate
  `BASS@3 + RIGHT_HAND@3 → accented RIGHT_HAND@3.5`
- A dropout bar restores one restrained `BASS + RH_BOTTOM @ 1.5` (velocity 80) in two
  contexts only:
  - the following bar is split into two half-bar chords, so the measured dropout and the
    already-light split roll would stack;
  - the progression breathes more than once and this is its last dropout, so the closing
    phrase would end thinner than the phrase before it.
- A progression with a single dropout — an eight-bar progression, for instance — keeps the
  measured breath exactly as authored.
- Selected-note velocity is shaped only by piano hand and ascending rank
- CC64: none; body comes from written gates and measured overlap
- All regular attacks are grid-locked; no random Humanize is added

## Forbidden data

Source pitch, pitch class, key, chord name, progression and melody must not enter
Production. Every emitted note must be an unchanged subset of the user's Shared
Base Voicing. Passing notes, octave displacement and style-owned revoicing are
forbidden.

## Release gates

- illegal pitch / passing note / duplicate MIDI / range failure: 0
- style-dependent Shared Base Voicing difference: 0
- slash-bass failure: 0
- eight-bar unique Attack Group counts: exactly `6 / 6 / 6 / 6 / 6 / 6 / 5 / 7`
- bars 1–6 Bass/RH-bottom response: exactly one at beat 1.5
- terminal roll offset: exactly 0.0438 beat
- output RH bottom/top velocity hierarchy: preserved
- CC64 events: 0
- short chords: physical-bar windows (the profile advances by bar, never by chord count)
- two-beat first half: `0 / 1 / 1.5 / 1.75`; the `1.75` RH attack anticipates the next chord
- two-beat second half: boundary `BASS@0`, then measured RH tail at `0.5 / 1.5`
- boundary-clipped Dance gate floor: 0.5 beat
- explicit anticipation ownership preserves the Harmony hard gate without globally widening it
- releaseCut CC64: 0
- live, MIDI and video schedules: identical
- protected existing Style digest changes: 0

Build 22 real-device listening is approved. This profile is the release
authority for `natural.dance1` unless a future explicitly versioned candidate
passes the same automated and device gates.

The two-beat chord-window correction above was added after a user-exported
110-BPM progression exposed quarter-beat gate truncation and premature phrase
advancement. Its device audition remains pending.

The contextual bar-7 support was added after a separate 130-BPM export measured
23 notes in an earlier Am7, 16 in the dropout Am7, and 21 across the following
Gm7/C7 split bar. The support raises only that dropout Am7 to 18 notes and awaits
device audition.

The closing-phrase trigger was added after a 140-BPM sixteen-bar export
(`Fadd9 … Gsus4 Fm C`) measured 16 notes in the bar-15 Fm against 18 in every other
four-beat bar. Its first phrase had already been supported by the split-bar rule, so
the same phrase position sounded full in the first half and thin in the second. The
trigger raises only that closing Fm to 18 notes; the bar-15 roll/fill and the other
seven Styles are byte-identical.
