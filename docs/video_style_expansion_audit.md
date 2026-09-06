# Video Style Expansion Audit

## Status

- Phase: V0 — current video export audit
- Result: Approved
- Scope: Documentation only
- Production code changes: None
- Next gate: Phase V1 must receive separate approval

## Current Architecture

The current video export pipeline is divided into four responsibilities:

1. The export screen captures an immutable editor-session snapshot.
2. `videoExportService` builds the existing performance and renders its offline audio.
3. `buildExportPlan` converts the progression into time-based visual segments.
4. The iOS module draws frames, muxes the audio, and returns a temporary MP4.

```text
src/app/export.tsx
  runExport(save | share)
    -> videoExportService.exportAndSave / exportAndShare
      -> buildSessionPerformancePlan
      -> cycleDurationSec
      -> audioService.renderAudioFile
      -> buildExportPlan
      -> ChordVideoExportNative.exportVideo
        -> ChordVideoExportModule.swift
        -> VideoWriter.write
          -> FrameRenderer.makeImage
          -> AVAssetReader audio mux
      -> temporary MP4
        -> expo-media-library save
        -> expo-sharing share sheet
```

Music generation, visual planning, frame rendering, encoding, and sharing are already
separated well enough to add visual styles without changing musical behavior.

## Relevant Files

### UI and service boundary

- `src/app/export.tsx`
- `src/services/videoExport/index.ts`
- `src/services/videoExport/types.ts`
- `src/services/videoExport/performanceInput.ts`
- `src/services/videoExport/buildVideoAudioRequest.ts`
- `src/lib/exportPlan.ts`
- `src/lib/exportCycleTiming.ts`

### TypeScript to Native boundary

- `modules/chord-video-export/index.ts`
- `modules/chord-video-export/src/ChordVideoExportModule.ts`
- `modules/chord-video-export/src/ChordVideoExport.types.ts`

### iOS renderer and encoder

- `modules/chord-video-export/ios/ChordVideoExportModule.swift`
- `modules/chord-video-export/ios/FrameRenderer.swift`
- `modules/chord-video-export/ios/VideoWriter.swift`
- `modules/chord-video-export/ios/KeyboardLayout.swift`

### Existing tests

- `src/lib/__tests__/exportPlan.test.ts`
- `src/lib/__tests__/exportCycleTiming.test.ts`
- `src/lib/__tests__/exportMeterAgreement.test.ts`
- `src/services/videoExport/__tests__/performanceInput.test.ts`
- `src/services/videoExport/__tests__/buildVideoAudioRequest.test.ts`
- `src/lib/__tests__/iconAssets.test.ts`

## Current Render Contract

The data path is:

```text
VideoExportInput
  -> BuildExportPlanParams
  -> ExportPlan
  -> ChordVideoExportNative.exportVideo
  -> ExportPlanRecord
  -> RenderPlan
```

`ExportPlan` contains the dimensions, frame rate, exact duration, offline audio URI,
title and song metadata, keyboard range, and time-based `ExportSegment` values.

Each `ExportSegment` already contains:

- chord and degree labels
- visual accent color
- optional local-key indicator
- highlighted MIDI notes
- `startSec`
- `durationSec`

The native module contains no harmony generation. It maps the supplied record into a
native render plan and forwards it to `VideoWriter`.

## Audio and Visual Timing

The performance output remains authoritative:

1. `buildSessionPerformancePlan` determines the performed beat count and BPM.
2. `cycleDurationSec` converts that performance boundary to seconds.
3. `buildVideoAudioRequest` renders audio from the same Final MIDI snapshot used by
   playback.
4. `buildExportPlan` creates visual segments from chord durations using the same meter
   scaling as the performance path.
5. `VideoWriter` uses `frameIndex / fps` as the video presentation time.
6. One high-resolution `CMTime endTime` clips both the audio reader and writer session.

`exportMeterAgreement.test.ts` verifies that audio chord onsets and visual segment
onsets remain aligned for the supported meters.

Future visual events must be derived from `ExportPlan.segments`. Style renderers must
not independently calculate chord or stage timing.

Classic must continue using its current timing path and must not be migrated to the new
visual-event timeline merely for architectural uniformity.

## Classic Freeze Decision

**Classic renderer is frozen behavior.**

Current Classic already contains:

- BPM-synced beat pulse
- chord onset fade/slide
- chord name scale
- radial glow
- progression dots
- keyboard highlight/glow
- watermark

Therefore Pulse must not be implemented by moving existing Classic behavior.

Classic means the current output produced by `FrameRenderer.makeImage`. Its timing,
layout, font selection, colors, animation values, keyboard rendering, watermark,
encoding settings, duration, and audio synchronization are compatibility behavior.

Phase V1 must not modify:

- `modules/chord-video-export/ios/FrameRenderer.swift`
- `modules/chord-video-export/ios/VideoWriter.swift`

The existing React Native preview is not a pixel-accurate Classic oracle. Native Classic
contains animation, slide, glow, and keyboard effects that the preview does not fully
reproduce.

## Architecture Decision: Style, Template, and Stage Data

The following concepts are separate:

```text
VideoVisualStyle
= visual rendering behavior

VideoTemplateId
= temporal/content composition of a video

EvolutionVideoStage
= stage metadata consumed by a template/renderer
```

**Evolution is not a pure Visual Style.**

Pulse and Flow describe how an existing render plan is drawn. Evolution includes a
stage sequence, stage labels, chord-set transitions, and a final hold, so it belongs to
the video-template/content-composition responsibility.

The long-term model is expected to resemble:

```ts
type VideoVisualStyle = 'classic' | 'pulse' | 'flow';
type VideoTemplateId = 'standard' | 'evolution';
```

`VideoTemplateId` and `EvolutionVideoStage` are future contracts and are not part of
Phase V1.

The video layer must never call the Evolution Engine. A future Evolution template may
only consume stage metadata that was prepared by an upstream application boundary.
Visual rendering must not mutate stage chords, the editor session, or harmony-domain
state.

This also preserves the separate roadmap concept documented in
`docs/roadmap/2026-09/07_shorts_video_templates.md`.

## Pulse Responsibility

Classic remains the tasteful animated chord display that already ships.

Pulse is redefined as rhythm and progress visualization:

- stronger chord-onset focus
- current-chord lift
- horizontal progress trace
- chord-to-chord motion emphasis

Pulse must not be created by extracting or increasing the existing Classic beat pulse.
Its additional behavior must read the common visual timeline derived from segments.

## Safe Extension Points

### Phase V1

Add a pure visual-style model and registry:

```ts
export type VideoVisualStyle = 'classic' | 'pulse' | 'flow';
```

The existing export contracts receive only an optional field:

```ts
visualStyle?: VideoVisualStyle;
```

Normalization is performed before the plan crosses the native boundary:

```ts
const visualStyle = normalizeVideoVisualStyle(input.visualStyle);
```

Missing and invalid values resolve to `classic`. Existing callers require no changes.

The Swift record may accept a `visualStyle` string with a `classic` default, but Phase
V1 does not pass it into a new renderer and does not branch on it. The renderer ignores
the value in V1, so the visible output remains unchanged.

### Later rendering phases

A new style dispatcher may be added beside the existing renderer. Its Classic path must
delegate directly to the unchanged `FrameRenderer.makeImage`.

Pulse and Flow should live in new style-specific files. A single large switch containing
all drawing implementations is rejected.

## Phase V1 Scope

Phase V1 is **Visual Style contract only**.

Recommended V1 files:

### New

- `src/services/videoExport/videoVisualStyle.ts`
- `src/services/videoExport/__tests__/videoVisualStyle.test.ts`
- a repository-consistent Classic freeze/contract test

### Minimal changes

- `src/services/videoExport/types.ts`
- `src/services/videoExport/index.ts`
- `src/lib/exportPlan.ts`
- `src/lib/__tests__/exportPlan.test.ts`
- `modules/chord-video-export/ios/ChordVideoExportModule.swift`

### Explicitly unchanged in V1

- `modules/chord-video-export/ios/FrameRenderer.swift`
- `modules/chord-video-export/ios/VideoWriter.swift`
- Export UI
- feature flags
- analytics
- persistence
- Visual Timeline
- `VideoTemplateId`
- `EvolutionVideoStage`
- all music, playback, MIDI, and audio-generation code

The V1 data flow is:

```text
existing export
  -> optional visualStyle
  -> normalize
  -> ExportPlan
  -> Swift record accepts it
  -> renderer ignores it
```

The correct user-visible result of V1 is zero changed pixels.

## Freeze Protection Proposal for V1

Use the repository's existing normalized SHA-256 freeze-gate pattern.

Before V1 starts:

1. Normalize CRLF to LF.
2. Record SHA-256 values for `FrameRenderer.swift` and `VideoWriter.swift`.
3. Add a test that reads both files and compares their normalized hashes.
4. Run this test with all existing export tests.

Any V1 edit to either file must fail the gate.

This is preferable to an MP4 byte Golden because H.264 output can differ across OS,
hardware, and encoder versions. PNG frame Goldens may be added when new renderer styles
begin, but they are not part of V0 or V1.

The freeze guard must protect source behavior without including temporary MP4 paths or
OS-dependent encoder output.

## Test Strategy

### Phase V1 unit and contract tests

- registry contains exactly `classic`, `pulse`, and `flow`
- registry definitions match their IDs
- omitted style resolves to `classic`
- invalid persisted/runtime input resolves to `classic`
- explicit valid styles survive plan construction
- existing callers compile without `visualStyle`
- existing `ExportPlan` timing and segment tests remain unchanged
- native record has a `classic` default
- `FrameRenderer.swift` hash remains unchanged
- `VideoWriter.swift` hash remains unchanged

### Existing regression suite

- segment layout and clipping
- progression tiling
- exact cycle duration
- meter agreement
- Final MIDI fidelity
- voicing and instrument-effect propagation
- watermark resource contract

### Later native visual tests

- deterministic PNG frames at selected timeline boundaries
- frame immediately before, at, and after a chord onset
- four and eight chords
- major and minor
- slash and tension chords
- multiple BPM and meter values
- long names such as `C#m7(♭5)`, `G13(♭9)`, and `Fmaj9/A`
- loop-end continuity
- render time, memory, crash, and export-failure checks

## Risks

1. Classic already contains Pulse-like animation. Extracting it would silently change
   existing output.
2. Abstracting `FrameRenderer` can change draw order, fonts, alpha, or timing even when
   the formulas appear equivalent.
3. There is currently no native pixel Golden or renderer performance baseline.
4. An Evolution template can create audio/visual semantic mismatch if stage chords
   differ from the fixed final-progression audio.
5. The React Native preview cannot be used as proof of Native Classic equivalence.

## Deferred Decisions

These decisions do not block V1:

- whether an Evolution template keeps final-progression audio throughout all visual
  stages
- the exact boundary between a future `VideoTemplateId` recipe and renderer stage data
- the reference iPhone/iOS combination for PNG and performance baselines
- whether visual-style selection should later persist in SQLite `app_meta`

The recommended Evolution behavior is to leave the existing final-progression audio
unchanged and treat supplied stage metadata as visual-only. Any requirement for
stage-specific audio would be a separate audio/export design and is outside this visual
style expansion.
