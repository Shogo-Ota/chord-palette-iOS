# Chord Palette Growth Implementation Plan

## Status and authority

- Prepared: 2026-09-13
- Audit baseline: `feature/flow-falling-blocks` at `0e27280`
- Current phase: CP-0 only
- CP-1, CP-2, and CP-3 implementation: Not yet approved
- Source audit:
  `docs/implementation/chord-palette-growth-audit.md`
- Proposed requirement:
  `C:\Users\shogo\Downloads\Chord-Palette-Cursor-Requirements-and-Design-v1.md`

This plan maps the proposed growth requirement to the current repository. Each phase
requires a separate start approval. A phase may not claim completion from TypeScript
tests when its acceptance requires a new native build or physical-device evidence.

## First product milestone

The first completed flow is:

```text
existing progression
  -> preview an existing Evolution candidate
  -> apply that candidate
  -> open Video Export
  -> choose Standard or Compare
  -> preview the base/variant story
  -> save or share one A-then-B vertical video
```

The user does not edit a video timeline. Compare output does not generate harmony and
does not modify the Project, Evolution candidate, Performance Plan, Style, Energy,
tempo, key, or audio settings.

## Architecture decision

### Separate Story Template from Visual Style

The existing contract remains:

```ts
type VideoVisualStyle = 'classic' | 'pulse' | 'flow';
```

The new orthogonal contract is:

```ts
type VideoTemplateId = 'standard' | 'compare';
```

`standard` continues to use the selected Classic/Pulse/Flow renderer. `compare`
selects a versioned Compare story and renderer. It does not become a fourth visual
style and does not overwrite the user's Standard style preference.

### Data flow

```text
EditorSession
  + existing EvolutionCandidate
  -> ComparisonDraft
       base CreationSnapshot
       variant CreationSnapshot
       semantic HarmonyChange list
  -> CompareCompatibility
  -> frozen SessionPerformancePlan A and B
  -> CompareTimePlan in integer source samples
       -> combined offline audio request
       -> versioned CompareSceneManifest
            -> React Native preview
            -> Native CompareFrameRenderer
  -> existing writer/mux/save/share boundary
```

The video layer consumes snapshots and performance results. It never calls the
Evolution generator and never temporarily applies data to the Editor.

### Layer ownership

- `src/app/`: thin screen composition and user input only.
- `src/features/editor/chordEvolution/`: capture/invalidate the ephemeral comparison
  draft at the existing Apply/Undo boundary.
- `src/features/videoExport/`: template selection, preview adapter, job state,
  preference hooks, and user-facing errors.
- `src/lib/comparison/`: immutable creation snapshot, semantic harmony diff, and
  compatibility policy.
- `src/lib/videoExport/comparison/`: deterministic sample/frame time plan, scene
  manifest, and scene evaluation.
- `src/services/videoExport/`: audio/native orchestration, cleanup, validation, and
  error translation.
- `src/repositories/`: CP-3 revision and preference persistence.
- `modules/chord-video-export/ios/`: Compare record mapping and drawing only. It does
  not generate music or derive semantic diffs.

## Shared contracts

Names may be refined during CP-1, but responsibilities must not merge.

### Immutable creation snapshot

```ts
type CreationSnapshotV1 = Readonly<{
  schemaVersion: 1;
  snapshotId: string;
  sourceProjectId: string | null;
  sourceRevision: string;
  title: string;
  key: MajorKey;
  mode: KeyMode;
  bpm: number;
  progression: readonly ReadonlyChordEvent[];
  grooveId: string;
  accompanimentPattern: AccompanimentPattern;
  accompanimentVariant: string;
  accompanimentEnergy: AccompanimentEnergy;
  instrumentId: InstrumentId;
  instrumentEffect: InstrumentEffect;
  octaveShift: number;
  drumMode: DrumMode;
  drumBeat: DrumBeat;
}>;
```

The snapshot contains music/render settings, not entitlement booleans or store
receipts. `sourceRevision` is a canonical content fingerprint until CP-3 adds a
persisted revision ID. Snapshot creation performs a nested copy and validation;
`Readonly` alone is not treated as immutability.

### Semantic harmony change

```ts
type HarmonyChangeV1 = Readonly<{
  changeId: string;
  kind: 'replace' | 'insert' | 'remove' | 'notation-only';
  baseIndex: number | null;
  variantIndex: number | null;
  baseEventId: string | null;
  variantEventId: string | null;
  changedFields: readonly (
    | 'root'
    | 'quality'
    | 'extension'
    | 'bass'
    | 'duration'
  )[];
  summaryKey: string;
}>;
```

The diff uses root offset/spelling, definition/suffix, bass, duration, and stable
event identity. Display-name string slicing is not the semantic source. Enharmonic
notation-only changes are distinguished from audible harmony changes.

### Compatibility result

```ts
type CompareCompatibility =
  | Readonly<{
      supported: true;
      alignment: 'one-to-one';
      totalBeats: number;
      changes: readonly HarmonyChangeV1[];
      copyKey: 'single-change' | 'multi-change';
    }>
  | Readonly<{
      supported: false;
      reason:
        | 'MISSING_BASE'
        | 'IDENTICAL'
        | 'STALE_VARIANT'
        | 'TEMPO_MISMATCH'
        | 'METER_MISMATCH'
        | 'KEY_MISMATCH'
        | 'AUDIO_SETTING_MISMATCH'
        | 'DURATION_MISMATCH'
        | 'INSERTION_NOT_V1'
        | 'UNSUPPORTED_EVENT';
    }>;
```

Initial Compare V1 requires equal tempo, meter, key/mode, Style, variant, Energy,
instrument/effect, octave, drum settings, and total beats. It accepts aligned
replacement candidates. L3 insertion may preserve total beats but is initially
reported as `INSERTION_NOT_V1` because “same position” is not proven by equal length.
No random candidate is generated to fill an unsupported case.

### Sample-index time plan

```ts
type CompareTimePlanV1 = Readonly<{
  schemaVersion: 1;
  sampleRate: number;
  durationSamples: number;
  fpsNumerator: 30;
  fpsDenominator: 1;
  segments: readonly Readonly<{
    id: string;
    role: 'base' | 'variant';
    startSample: number;
    durationSamples: number;
    snapshotId: string;
  }>[];
  harmonyEvents: readonly Readonly<{
    role: 'base' | 'variant';
    eventId: string;
    startSample: number;
    durationSamples: number;
  }>[];
}>;
```

All sample fields must be finite, non-negative safe integers. The actual
`RenderAudioResult.sampleRate` is authoritative. Frame PTS remains integer
`frameIndex / fps`; mapping a frame to the media plan uses one documented conversion
and cross-language fixtures. Story duration for the 100 BPM, four bars per version
fixture is 19.2 seconds, or 921,600 source samples at 48 kHz.

## CP-1: Snapshot, semantic diff, and comparison time plan

### Target

- FR-01: immutable base/variant snapshots
- FR-02: existing Preview/Apply/Undo path remains authoritative
- FR-14: comparison data cannot grant Pro access
- FR-15 foundation: preserve existing success-boundary Evolution events
- equal-length A/B compatibility and sample-index time plan

### Out of scope

- Compare screen/rendering
- native module changes
- persistent Project revisions
- new Evolution generation rules or ranking
- L4 integration
- billing product/price changes
- backend/share links

### Files to add

- `src/lib/comparison/contracts.ts`
- `src/lib/comparison/createSnapshot.ts`
- `src/lib/comparison/canonicalSnapshot.ts`
- `src/lib/comparison/semanticHarmonyDiff.ts`
- `src/lib/comparison/compareCompatibility.ts`
- `src/lib/comparison/index.ts`
- `src/lib/comparison/__tests__/createSnapshot.test.ts`
- `src/lib/comparison/__tests__/semanticHarmonyDiff.test.ts`
- `src/lib/comparison/__tests__/compareCompatibility.test.ts`
- `src/lib/videoExport/comparison/contracts.ts`
- `src/lib/videoExport/comparison/buildCompareTimePlan.ts`
- `src/lib/videoExport/comparison/index.ts`
- `src/lib/videoExport/comparison/__tests__/buildCompareTimePlan.test.ts`
- `src/features/editor/chordEvolution/comparisonDraftStore.ts`
- `src/features/editor/chordEvolution/__tests__/comparisonDraftStore.test.ts`

### Files to modify

- `src/features/editor/chordEvolution/useChordEvolution.ts`
  - Necessary extension: prepare a draft from the exact pre-Apply session and
    validated materialized result; publish it only after `APPLIED`.
  - Undo and incompatible subsequent edits invalidate availability by fingerprint.
  - Existing Preview and Apply functions remain the only audio/mutation boundaries.
- `src/features/editor/chordEvolution/index.ts`
  - Export only the feature-facing draft selector.
- Existing Evolution hook/atomic tests
  - Add non-mutation and one-Undo-entry assertions; do not rewrite accepted behavior.

No Project, DB, Performance Engine, Energy, audio native, or video native file is
modified in CP-1.

### Implementation sequence

1. Define runtime validation limits from current app constraints: finite BPM 40-300,
   current progression/bar cap, legal MIDI-independent harmony fields, unique event
   IDs, and supported durations.
2. Implement nested snapshot copying and canonical serialization/fingerprint.
3. Adapt existing `EvolutionCandidate.before/after/changes` into semantic changes.
4. Implement one-to-one Compare V1 compatibility with explicit reason codes.
5. Implement the actual-sample-rate time-plan builder.
6. Add an ephemeral Comparison Draft store in the Evolution feature.
7. Extend successful Apply to publish the prepared draft; failed/stale/paywalled
   Apply and Preview publish nothing.
8. Invalidate stale drafts without changing Editor history or Project data.

### Tests

- snapshot is deeply independent from Session and candidate arrays
- source Session and candidate are not mutated
- deterministic canonical fingerprint and ordering
- replacement root/quality/extension/bass/duration fields
- enharmonic notation-only vs audible change
- exact identical-pair rejection
- multiple changes get truthful generic copy
- insertion is distinguished and rejected for Compare V1
- BPM/meter/key/Style/Energy/instrument/effect/drum/length mismatch reasons
- 4/4, four chords, 100 BPM: A 9.6 s + B 9.6 s = 19.2 s
- 48 kHz fixture: B starts at sample 460,800; end is 921,600
- high/low BPM and safe-integer boundaries
- successful Apply creates one draft and one existing Undo history entry
- Preview, failed Apply, paywall, and Undo never create false comparison availability
- entitlement boolean/store data is absent from snapshots

### Risks and controls

- Risk: the draft becomes stale after normal editing.
  Control: content fingerprint validation at read/export time; no silent rebasing.
- Risk: changing the accepted Evolution hook causes Apply/Undo regression.
  Control: additive draft publisher after success, dependency injection in tests, and
  existing L1-L3 architecture/freeze gates.
- Risk: a display-name diff misrepresents harmony.
  Control: semantic fields first; text formatter consumes validated summary keys.

### Completion and approval gate

CP-1 is complete only when pure contracts, Apply integration, and focused/full
regression tests pass with no Project/Performance/native change. Report actual test
counts from the run. Then stop and request CP-2 approval.

Estimated implementation: 60-100 minutes plus test execution.

## CP-2: Minimum complete Compare video

### Target

- FR-05 through FR-11
- Compare V1: base one cycle, then variant one cycle
- FX-01, FX-02, FX-04, FX-06, FX-07, FX-09
- official video icon and approved product-name lockup
- Standard/reduced motion preference
- same versioned scene manifest for app preview and native output
- recoverable export job with final-file validation

FX-03/05 are enabled only when the source event and render cost are proven. FX-08
does not modify Energy profiles. FX-10 is evaluated only as visual background
periodicity; the A/B semantic reset remains visible.

### Out of scope

- four-stage Evolution video
- Style/Energy comparison
- social auto-posting
- Project revision persistence
- new music or audio engine
- particle systems, 3D, waveform simulation
- Web preview/share backend

### Files to add

Pure scene:

- `src/lib/videoExport/comparison/sceneContracts.ts`
- `src/lib/videoExport/comparison/buildCompareSceneManifest.ts`
- `src/lib/videoExport/comparison/evaluateCompareScene.ts`
- `src/lib/videoExport/comparison/compareCopy.ts`
- `src/lib/videoExport/comparison/validateCompareScene.ts`
- focused tests beside these files

Feature/UI:

- `src/features/videoExport/VideoTemplateSelector.tsx`
- `src/features/videoExport/CompareVideoPreview.tsx`
- `src/features/videoExport/comparePreviewAdapter.ts`
- `src/features/videoExport/useCompareVideoExport.ts`
- `src/features/videoExport/videoExportJob.ts`
- `src/features/videoExport/useVideoMotionPreference.ts`
- component/hook/job tests

Repository:

- `src/repositories/videoMotionPreferenceRepository.ts`
- `src/repositories/__tests__/videoMotionPreferenceRepository.test.ts`

Service:

- `src/services/videoExport/buildComparePerformance.ts`
- `src/services/videoExport/buildCompareAudioRequest.ts`
- `src/services/videoExport/buildCompareExportPlan.ts`
- `src/services/videoExport/validateExportedVideo.ts`
- focused service tests

Native Compare-only files:

- `modules/chord-video-export/ios/CompareSceneRecord.swift`
- `modules/chord-video-export/ios/CompareFrameState.swift`
- `modules/chord-video-export/ios/CompareFrameRenderer.swift`
- `modules/chord-video-export/ios/CompareBrandRenderer.swift`
- `modules/chord-video-export/ios/CompareSceneValidator.swift`

Acceptance:

- `docs/acceptance/chord-palette-growth-cp-2.md`
- reviewed Compare Golden frames under `docs/acceptance/`

### Files to modify

- `src/app/export.tsx`
  - Keep it thin: bind template, target, title, motion, preview, save/share, progress,
    and errors from the feature hook.
- `src/services/videoExport/index.ts`
  - Add a Compare orchestration entry that accepts already-captured snapshots.
  - Standard entry and defaults remain unchanged.
- `src/services/videoExport/types.ts`
  - Add optional `templateId` and versioned Compare sidecar. Missing means Standard.
- `modules/chord-video-export/src/ChordVideoExport.types.ts`
- `modules/chord-video-export/ios/ChordVideoExportModule.swift`
  - Map optional Compare records and reject invalid Compare manifests.
- `modules/chord-video-export/ios/VideoFrameRendererRegistry.swift`
  - Select Compare renderer by template before Standard visual-style selection.
- `src/services/analytics/index.ts`
  - Add job-scoped Compare/export terminal/share-sheet event names.
- Existing export preference, screen, service, architecture, and Freeze tests.

### Frozen files and native cancellation checkpoint

The first CP-2 implementation attempt must leave these files unchanged:

- `modules/chord-video-export/ios/FrameRenderer.swift`
- `modules/chord-video-export/ios/ClassicFrameRendererAdapter.swift`
- `modules/chord-video-export/ios/PulseFrameRenderer.swift`
- `modules/chord-video-export/ios/PulseFrameState.swift`
- `modules/chord-video-export/ios/FlowFrameRenderer.swift`
- `modules/chord-video-export/ios/VideoWriter.swift`

The current native API has no cancellation handle. True FR-11 cancellation may not
be implementable only at the module boundary. Before claiming CP-2 completion:

1. Prototype job cancellation against the existing async export boundary.
2. If it cannot stop AVAssetWriter/AVAssetReader and release temporary resources,
   stop and request a separate approval to make the smallest possible
   `VideoWriter` change.
3. The approved minimal change would add a cancellation token, call
   `cancelWriting()`/`cancelReading()`, finish each dispatch-group path exactly once,
   and delete only this job's temporary files.
4. Re-run Standard Classic/Pulse/Flow exports and hashes/Goldens after that change.

Hiding progress or ignoring a completed file is not accepted as cancellation.

### Scene and timing policy

The TypeScript planner computes:

- base and variant Story sample intervals
- every chord boundary
- change anticipation interval, capped at 300 ms and 50% of the previous event
- reveal interval and changed semantic tokens
- A/B labels, current and next event IDs, page boundaries, and copy keys
- motion preset and template/theme versions

Native receives these intervals once. It performs bounds-checked interval lookup and
drawing only; it does not re-run diff, BPM arithmetic, Evolution, or Performance.
The React Native preview consumes the same manifest. Both adapters share fixed frame
fixtures that map frame index to expected sample/cue state.

For long progressions, the planner paginates at harmony boundaries and exposes at
most four cards per page. It does not shrink an entire eight-chord progression into
unreadable text.

### Audio policy

1. Build frozen Performance Plan A and B once from their snapshots and one resolved
   tier/render configuration.
2. Build two Final MIDI snapshots.
3. Offset every B note/CC/marker by A's exact beat/sample duration in a pure builder.
4. Render one combined offline audio file through the existing audio service and
   common master path.
5. Do not normalize A and B independently in V1.
6. Preserve negative/pickup clamping policy explicitly and test B-boundary events.
7. Keep Count-in absent.

If beat-offset composition cannot represent a future tempo map, the planner fails
closed. It does not force the input to 4/4 or a different BPM.

### Export job state

The feature state machine is:

```text
idle
  -> validating
  -> preparing
  -> rendering
  -> muxing
  -> ready
  -> saved or shareSheetOpened

validating/preparing/rendering/muxing
  -> failed or cancelled
```

- One locally generated job ID per explicit start.
- One active job; repeated taps do not create jobs.
- Indeterminate progress during unmeasured preparation.
- Frame progress only while rendering.
- `ready` only after file validation.
- Exactly one terminal analytics event per job ID.
- Retry reuses the same immutable snapshot pair unless the user explicitly selects a
  new target.
- Job-owned temporary audio/video is deleted after failure/cancel or when no longer
  needed; saved photo assets are never deleted.

### Tests

Pure and service:

- Standard remains default when template fields are missing/invalid
- Standard input/plan/audio is unchanged byte-for-byte where currently frozen
- 19.2-second fixture and exact B boundary
- single/multiple/no-change copy truthfulness
- preview/native fixture states at start, before change, change, after, B boundary,
  and end
- first frame at or after a boundary owns the new current chord
- anticipation never exceeds contract
- no fake attack during rests; anticipation ownership handled separately
- 4/8/long progression pagination and complex symbols
- reduced motion keeps all semantic information
- A/B Final MIDI contains exact source events with only B offset
- video settings do not change either Performance Plan
- malformed sidecar, duplicate IDs, unsafe samples, bad ranges, unknown versions
- repeated start, cancel, retry, and one terminal event
- cleanup affects only job-owned temporary files

Native/acceptance:

- Compare renderer architecture gate: no Engine/Evolution imports
- Classic/Pulse/Flow source and Golden Freeze gates
- at least five reviewed Compare frames: start, pre-change, change, post-change, end
- decoded MP4: H.264, AAC, target dimensions/fps, audio track, monotonic PTS
- decoded audio onset and visual boundary at start/change/end within one frame target
- no cumulative drift at the final boundary
- standard and reduced motion on a physical iPhone
- save, share sheet, permission rejection, cancel, interruption, low-space failure,
  retry, and no Project loss
- record device model, iOS, build ID, commit, duration, output time, and peak memory

### Dependencies

No new npm/native dependency is planned. Use existing Expo FileSystem, MediaLibrary,
Sharing, AVFoundation, CoreGraphics/UIKit, React Native motion settings, and current
font/icon assets.

### Risks and controls

- Cross-platform text layout may differ.
  Use one scene manifest, typography constraints, and reviewed cross-renderer frames;
  do not promise pixel identity beyond defined tolerances.
- Compare rendering can regress Standard.
  Optional template fields default to Standard; existing renderers are not shared or
  refactored.
- Combined A/B audio can shift B or duplicate an endpoint event.
  Use sample/beat boundary fixtures and decoded-media onset checks.
- Cancellation can deadlock current writer queues.
  Use the explicit native checkpoint above; no fake success.
- New branding may conflict with Flow's icon-only rule.
  Scope the approved text lockup to Compare and keep Flow source frozen.

### Completion and approval gate

CP-2 is complete only after automated gates, a new EAS build, physical iPhone
acceptance, reviewed MP4/frames, performance data, and recovery tests are recorded.
Then stop and request CP-3 approval.

Estimated implementation: 2-4 hours, plus EAS queue/build time and 30-60 minutes of
physical-device review. A cancellation-driven `VideoWriter` change requires its own
approval and estimate.

## CP-3: Persistent original/adopted revisions and reuse

### Target

- FR-03 and FR-04
- original and adopted revisions survive restart
- old projects remain readable
- explicit reuse and duplicate flows use existing Project UI
- first-success/save/reuse analytics fire only at durable success boundaries

### Out of scope

- cloud sync
- unlimited revision history
- revision timeline editor
- share manifest/link
- billing price experiments

### Storage decision

Keep `Project` backward compatible and store revisions in additive tables rather than
embedding large revision arrays in every Project row.

Proposed tables:

```text
project_revisions
  id TEXT PRIMARY KEY
  project_id TEXT NOT NULL
  schema_version INTEGER NOT NULL
  kind TEXT NOT NULL
  payload TEXT NOT NULL
  parent_revision_id TEXT
  created_at INTEGER NOT NULL

project_revision_state
  project_id TEXT PRIMARY KEY
  original_revision_id TEXT
  adopted_revision_id TEXT
  updated_at INTEGER NOT NULL
```

The repository validates payloads on write/read. Original and adopted references are
updated in one SQLite transaction after all referenced rows exist. Old projects have
no state row and continue to open normally; no synthetic original is generated.

Initial retention target: at most 20 ordinary revisions per Project, excluding the
currently referenced original/adopted revisions. Preview creates none. Final policy
requires CP-3 approval before implementation.

### Files to add

- `src/lib/projectRevision/contracts.ts`
- `src/lib/projectRevision/validateProjectRevision.ts`
- `src/lib/projectRevision/index.ts`
- pure validation tests
- `src/repositories/projectRevisionRepository.ts`
- `src/repositories/__tests__/projectRevisionRepository.test.ts`
- `src/features/projects/projectRevisionUseCases.ts`
- `src/features/projects/useProjectRevisionState.ts`
- feature tests
- `docs/acceptance/chord-palette-growth-cp-3.md`

### Files to modify

- `src/lib/db.ts`
  - Add tables/indexes only; never delete or rewrite old Project rows.
- `src/features/editor/session.ts`
  - After a successful existing save, coordinate an explicitly pending adopted
    revision without adding Editor Undo entries.
- `src/features/editor/chordEvolution/comparisonDraftStore.ts`
  - Expose a pending base/variant record for successful save; Preview still writes
    nothing.
- `src/repositories/projectRepository.ts`
  - Only if one transaction must include Project upsert and revision references.
    Prefer a composed repository transaction over duplicating project SQL.
- Existing project/home/editor UI files
  - Show “continue”, existing duplicate, and explicit “record current as original”
    within current screens; do not add a dashboard by default.
- `src/services/analytics/index.ts`
  - Add once-only first creation, project saved, and saved-project reuse events.

### Tests

- migrate an old database and open/edit/save the old Project
- no state row means “original unavailable”, not a fabricated baseline
- original/adopted payload and references commit atomically
- interrupted/failed transaction leaves no dangling references
- Preview creates no revision
- Apply alone creates no durable revision until successful save
- autosave does not create an unlimited revision stream
- Undo semantics/history count remain unchanged
- restart restores base/variant selection
- duplicate receives a new Project ID and explicit parent metadata only
- retention never deletes referenced original/adopted revisions
- corrupt/unknown revision payload fails safely while the base Project still opens
- `project_saved`, reuse, and first-success event deduplication
- expired entitlement does not delete or mutate saved revisions

### Rollback

- Old builds ignore additive tables and continue reading `projects`.
- Growth UI is behind a default-off creation-revisions flag until migration/device
  acceptance passes.
- Disabling the flag hides revision features but preserves stored rows.
- Rollback never drops tables automatically.

### Completion and approval gate

CP-3 requires migration tests plus physical restart/interruption/duplicate/Undo
acceptance. Then report and stop. CP-4a requires separate scope and security review.

Estimated implementation: 90-150 minutes plus 20-40 minutes of device lifecycle
acceptance.

## Feature flags and rollback sequence

Extend the existing typed feature-flag boundary with names matching repository style:

- `growthCompareExport`
- `growthSemanticVideoFx`
- `growthCreationRevisions`

CP-4 flags are not added until those phases start.

Rules:

1. Flags default off unless the approved release phase says otherwise.
2. Manual Standard/Compare and motion selections override experiment defaults.
3. Standard is the data-contract fallback for missing/invalid template values.
4. Disabling Compare does not delete snapshots/revisions or change Standard export.
5. Template/version/job IDs appear in diagnostics, not customer-facing labels.

## Analytics sequence

- CP-1 reuses existing Evolution success events and establishes typed metadata
  builders; it does not invent an event for every internal snapshot.
- CP-2 adds export job ID, template/version, story mode, motion preset, duration
  bucket, and exactly-one terminal outcome.
- `share_sheet_opened` means the OS sheet opened, not that an SNS post completed.
- CP-3 adds durable save/reuse/first-success events after repository/audio success.
- Renewal/expiration/refund events remain server-side future work and must not be
  inferred from UI refreshes.
- No title, chord list, note list, private Project ID, or media content is sent.

## CP-4 and CP-5 dependency record

### CP-4a

May start only after CP-3. It needs a versioned, size-limited JSON manifest, strict
runtime validation, preview, and import-as-new-copy. It reuses Project snapshot and
revision validation but never includes local IDs, entitlements, receipts, sound
assets, or private source MIDI.

### CP-4b

Blocked until CP-4a, owned domain/backend, authentication/owner management, revoke,
abuse/report handling, cost limits, privacy/retention, and public-operation approval.
Current Convex/Clerk values are placeholders, not an implementation.

### CP-5

Pricing, annual plan, four-stage video, Style/Energy comparison, batch output, and
ranking changes remain evidence-gated. The proposed prices are not authorized. No
Performance Engine, Energy profile, or purchase configuration change is included in
CP-0-CP-3.

## Required evidence per completed phase

Every phase acceptance document records:

- exact branch and commit
- changed and new files
- commands and actual results
- fixture inputs and expected contracts
- MP4/frame file names and hashes when native video is involved
- EAS build ID and physical device/OS when required
- measured export duration/time/memory rather than estimates
- untested behavior, existing warnings, and unrelated failures
- Freeze proof and rollback procedure
- unresolved product/design/entitlement decisions

CP-0 produces documentation only. No Slack completion notification is sent for
CP-0. The already requested `#chord-palette` notification is sent when the approved
implementation milestone is actually complete, with device/native limitations stated
truthfully.
