# Phase V3 Pulse Renderer Acceptance

## Result

- iOS Device Acceptance: PASS
- EAS development build: PASS
- Pulse PNG review baseline: Frozen
- Classic renderer source freeze: PASS
- Phase V4: Not started

## Accepted Behavior

- `pulse` renders independently from Classic.
- Active Chord Lift identifies the current chord on the progress track.
- Progress Trace advances from `ExportPlan.segments`.
- Chord Onset Focus appears at each segment boundary.
- `classic`, `flow`, and invalid native values retain the Classic path in V3.
- Save and Share both preserve the selected visual style.
- Audio, duration, export ending, keyboard content, and watermark remain valid.

## Source Video

- Filename: `chord-video-FDF0DEB6-A436-45CA-96D2-94CACF031D06.MP4`
- SHA-256: `a4ef55a8381071bdd6f822260c1d39375907e66d35e714af7b45623b5b96b896`
- Video: H.264, 720 × 1280, 30 fps, 222 frames, 7.400 seconds
- Audio: AAC, 44.1 kHz stereo, 7.384603 seconds
- Visible fixture: `Cadd9 | Fmaj7 | Gsus4 | Cadd9`, BPM 130
- Detected chord-onset frames: 0, 56, 111, 167

The received file is 720 × 1280 although the native export plan defaults to
1080 × 1920. It may therefore have been transcoded during device-to-PC transfer.
These PNGs are the approved visual review baseline, not an OS-independent
byte-level renderer oracle.

## Frozen PNG Frames

- Frame 000 / 0.000 s: first Cadd9 onset and maximum onset focus
- Frame 015 / 0.500 s: settled Cadd9 lift and in-segment trace progress
- Frame 056 / 1.867 s: Fmaj7 onset
- Frame 111 / 3.700 s: Gsus4 onset
- Frame 167 / 5.567 s: final Cadd9 onset
- Frame 221 / 7.367 s: final frame and completed trace

Files:

- `phase-v3-pulse-golden-frame-000.png`
- `phase-v3-pulse-golden-frame-015.png`
- `phase-v3-pulse-golden-frame-056.png`
- `phase-v3-pulse-golden-frame-111.png`
- `phase-v3-pulse-golden-frame-167.png`
- `phase-v3-pulse-golden-frame-221.png`

The repository test freezes each PNG's SHA-256 and verifies its 720 × 1280
dimensions. Future visual comparison should use reviewed PNGs or a perceptual
pixel threshold, never MP4 byte equality.

## Verification

- Typecheck: PASS
- Lint: 0 errors; 46 pre-existing warnings
- Video export service regression: 6 suites / 41 tests PASS
- Full Jest regression: 210 suites / 2932 passed / 1 skipped
- EAS build:
  `16f12402-a85b-4e79-ba35-65b556a14b82`

The first EAS attempt included the separate uncommitted Count-in experiment and
failed in that file. The accepted build was created from an isolated worktree
containing V1–V3 video changes only. The main workspace's Count-in and Phase 5
diffs were not modified.
