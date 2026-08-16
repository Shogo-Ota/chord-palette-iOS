# POP909 Pop Voicing Prior

Offline analyzer + scoring PoC. **Production accompaniment generation is unchanged.**

PopVoicingScore v0 is **retired for ranking** (human X > Y > Z vs score Y > X > Z). The prior is an **outlier rejector** only. Preference ranking is documented in `docs/chord_palette_preference_score.md`.

## Why

Chord Palette already has mechanical QA (legality, duplicates, crossing, teacher timing, playback). It does not yet have a quantitative prior for “does this voicing move like pop piano?”

POP909 is used as a **distribution**, not as a correct answer to copy.

| Source | Role |
|---|---|
| POP909 PIANO track | How pop piano voicings typically move |
| Teacher MIDI | Human performance style (unchanged) |
| User Chord | Harmony source of truth |
| Human listening | Final quality label |

## Datasets (local only)

Do **not** copy raw MIDI into the app bundle, npm package, or git.

| Dataset | Path | Official meaning |
|---|---|---|
| POP909 original | `LocalDatasets/POP909/POP909/{id}/{id}.mid` | MELODY / BRIDGE / **PIANO** (accompaniment) |
| POP909-CL | `LocalDatasets/POP909-CL/POP909_processed/{id}.mid` | Track 1 = mixed score; last note track = human-corrected chords |

Acquisition (already gitignored):

```bash
# POP909-CL processed (~5 MB)
curl -L -o LocalDatasets/POP909-CL/POP909_processed.zip \
  https://github.com/AndyWeasley2004/POP909-CL-Dataset/raw/main/POP909_processed.zip
unzip -o LocalDatasets/POP909-CL/POP909_processed.zip -d LocalDatasets/POP909-CL

# Original POP909 (~22 MB) — needed for the PIANO track
curl -L -o LocalDatasets/POP909/POP909.zip \
  https://github.com/music-x-lab/POP909-Dataset/raw/master/POP909.zip
unzip -o LocalDatasets/POP909/POP909.zip -d LocalDatasets/POP909
```

Inspection output: `LocalAnalysis/pop909/dataset_inspection.md`

### Piano track we use

**Original POP909 track named `PIANO`.**  
We do not use the CL combined score track (melody + accompaniment + rhythm). That would contaminate Top Voice.

### Chord track we use

**POP909-CL last note-bearing track**, decoded like their `process_pop909.py`: notes sharing an onset → pitch-class set → quality; lowest pitch → bass.

Known CL issues (excluded): `518.mid`, `620.mid` (README: hand misalignment).

## License

Recorded from the files on disk, not guessed:

| Corpus | Repo LICENSE | Paper |
|---|---|---|
| POP909 | MIT (`music-x-lab/POP909-Dataset/LICENSE`) | ISMIR 2020, CC BY 4.0 on the paper PDF |
| POP909-CL | MIT (`AndyWeasley2004/POP909-CL-Dataset/LICENSE`) | BACHI / ICASSP 2026 |

The arrangements are human piano covers of commercial pop songs. This PoC treats the files as a **local research dataset** and ships only aggregated statistics (`assets/quality/pop909_prior_v1.json`). Do not redistribute the raw MIDI with the app.

Cite if you publish results:

- Wang, Chen, et al., “POP909: A Pop-song Dataset for Music Arrangement Generation,” ISMIR 2020
- Yao, Chen, Dubnov, Berg-Kirkpatrick, “BACHI…,” ICASSP 2026

## Architecture (this PoC only)

```
POP909 PIANO + POP909-CL chords
  → attack groups → transition features
  → pop909_prior_v1.json
Chord Palette voicing pair
  → same features → PopVoicingScore 0–100 + warnings
```

Hard gates stay **outside** the score: user-chord legality, identical MIDI duplicates, invalid crossing, slash bass, playback pitch/CC64.

POP909 is a prior, not a single rule. Do not force every voicing to the mean, pin bass to root, or always maximize common tones.

## Run

```bash
npm run pop909:poc
```

Optional: `POP909_POC_LIMIT=120 npm run pop909:poc`

Unit tests (no raw MIDI):

```bash
npx jest src/lib/accompanimentQuality --no-coverage
```

## Blind listening

1. Open only `LocalAnalysis/pop909/poc_candidates/Candidate_X.mid` (and Y, Z).
2. Do **not** open `KEY_DO_NOT_SHOW.json` first.
3. Rate Overall / Chord Clarity / Voicing / Voice Leading / Register / Naturalness (0–100).
4. Record a preference order (e.g. X > Z > Y) in `LocalAnalysis/accompaniment_quality_dataset/preferences.json`.
5. Then compare with the key and `pop909Score`.

First listening (2026-08-15): human **X > Y > Z**, score **Y > X > Z**. Do not put this weighting into Production.

Preference data collection: `docs/chord_palette_preference_score.md`.

## Production

Unchanged. No realizer ranking. No release.
