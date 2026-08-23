# Natural Type2–5 Candidate Promotion Contract

Status: implementation candidate  
Source analysis: `LocalAnalysis/reo_style_candidates/`  
Decision date: 2026-08-23

## Approved mapping

- `natural.type1`: retain the approved production implementation unchanged.
- `natural.type2`: promote `STYLE_CANDIDATE_01`.
- `natural.type3`: promote `STYLE_CANDIDATE_02`.
- `natural.type4`: promote `STYLE_CANDIDATE_03`.
- `natural.type5`: promote `STYLE_CANDIDATE_04`.

Type2 and Type3 intentionally replace the rejected Build 12 gestures. Existing projects
saved with those IDs will receive the improved gesture. Type4 and Type5 are additive and
need no persistence migration.

## Human listening classification

The user classified all 60 source files by listening: Block 27, Funk 13,
Arpeggio 11 and Advanced 9. That evidence changes presentation without changing
the persisted candidate IDs:

- Natural: `natural.type1`, `natural.type2`
- Variation: City, `natural.type3` as Funk, `natural.type4` as Driving
- Arpeggio: `natural.type5` as Type 1, rising for beats 0–2 and falling for beats 2–4

The storage IDs intentionally remain unchanged so existing projects keep the
same notes and playback provider.

## Measured evidence

| Candidate | Files | Confidence | Attack groups/beat | Simultaneous-note ratio | Median gate | Key silence | Bass-independent attacks |
|---|---:|---|---:|---:|---:|---:|---:|
| 01 | 22 | HIGH | 1.000 | 0.875 | 0.500 | 0.500 | 0.400 |
| 02 | 12 | MEDIUM | 1.750 | 0.729 | 0.252 | 0.471 | 0.548 |
| 03 | 10 | MEDIUM | 2.611 | 0.682 | 0.322 | 0.139 | 0.596 |
| 04 | 4 | HIGH | 1.667 | 0.000 | 0.815 | 0.206 | 1.000 |

The split files do not provide a trustworthy absolute bar phase. Production profiles
therefore preserve inter-onset relationships, gate, velocity contour, silence and
low/upper voice role, while quantizing the inferred common phase to a stable 16th-note
grid.

## Production authority

The user chord and Shared Compact Base Voicing remain the only pitch authority:

1. Build the complete style-neutral Base Voicing.
2. Create the candidate's temporal Attack Group.
3. Select an unchanged subset of Base Voicing notes by mask or stable voice role.
4. Emit no pitch absent from that Base Voicing.

Source MIDI key, pitch, pitch class, chord label and progression are forbidden runtime
inputs. Passing notes, approach notes, revoicing and style-dependent octave movement are
forbidden.

## Protected 87-point baseline

The historical fixture
`src/lib/performance/__tests__/fixtures/accompanimentReleaseBaselineV87.json` is immutable.
These approved production outputs must retain their existing digests:

- Block Type1, Golden A–I
- Natural Type1, Golden A–I
- City Type1, Golden A–I

Natural Type2 and Type3 historical digests represent rejected gestures and are not release
authority. Type2–5 receive a new digest baseline only after device listening approval.

## Pedal and silence

Candidate CC64 is temporal evidence, not permission to erase authored rests. Candidate
profiles may use a reduced pedal envelope only when:

- written note duration is not stretched to imitate pedal;
- the attack-to-attack silence contract still passes;
- no chord boundary retains an unintended note;
- Final MIDI, live playback and export receive the same CC64 events.

Build 14 promotes a reduced envelope for Type2: Pedal Down during
`0–0.72`, `1–1.9`, `2–2.72` and `3–3.9` beats. Every principal rest and chord
boundary is Pedal Up. Build 15 adds an independent shorter envelope to Driving:
`0–0.82`, `1–1.68`, `2–2.82` and `3–3.68`. Funk and Arpeggio remain pedal-free,
Type1 retains its approved Teacher pedal, and `releaseCut` removes all CC64.

## Release gates

- illegal user-chord pitch classes: 0
- passing/approach notes: 0
- simultaneous duplicate MIDI: 0
- invalid voice crossing: 0
- MIDI range violations: 0
- slash-bass failures: 0
- style-dependent Base Voicing differences: 0
- Type1 / Block / City protected digest changes: 0
- live/export note and CC64 mismatches: 0
- short chords use an uncompressed prefix and clip only the final gate

Implementation stops at a Development Build. Type2–5 are not promoted to a release
baseline until device listening passes.
