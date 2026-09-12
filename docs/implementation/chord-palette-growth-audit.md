# Chord Palette Growth CP-0 Audit

## Status

- Audit date: 2026-09-13
- Input requirement: `C:\Users\shogo\Downloads\Chord-Palette-Cursor-Requirements-and-Design-v1.md`
- Baseline branch: `docs/cp0-growth-audit`
- Baseline commit: `0e27280` (`feature/flow-falling-blocks`)
- Scope: CP-0 documentation and architecture audit only
- Production code changes: None
- CP-1 authorization: Not granted

This audit treats the 2026-09-10 growth document as a new proposed requirement and
maps it to code that exists at the baseline commit. Historical reports are evidence,
not a substitute for a fresh build or device test.

## Workspace and branch isolation

The original workspace remains on `feature/chord-evolution` at `1c1b408`. It contains
uncommitted L4 and Count-in work. That workspace and those changes were not modified.

The CP-0 worktree was created from `feature/flow-falling-blocks` at `0e27280` because
it contains the latest approved implementation direction for Flow. This baseline
contains accepted L1-L3 Evolution code and the local Falling Block implementation.
It does not contain the uncommitted L4 implementation from the original workspace.

Consequences:

- L1-L3 may be used as the initial comparison-candidate source.
- L4 must not be described as part of this baseline or as released.
- Falling Block Flow is implemented and automatically tested, but its new native
  behavior has not passed a new EAS build and iOS device acceptance.
- The Count-in sample-timeline experiment remains outside this worktree and outside
  CP-0.

## Classification legend

- `EXISTING`: The required capability and a production path exist.
- `PARTIAL`: A reusable capability exists, but the growth contract is incomplete.
- `MISSING`: No implementation for the required capability was found.
- `BLOCKED`: Work depends on an explicit approval, external resource, or unresolved
  ownership/entitlement decision.
- `UNKNOWN`: Repository evidence is insufficient. This is not an implementation
  justification.

## Executive audit

| Area | Status | Finding |
|---|---|---|
| Project | PARTIAL | Local save, autosave, duplicate, and in-memory Undo exist; immutable revisions and persistent original/adopted relationships do not. |
| Evolution | PARTIAL | L1-L3 Preview/Apply/Undo and candidate before/after contracts exist; the UI is feature-flagged off by default and no comparison target survives Apply/restart. |
| Audio | PARTIAL | Playback, MIDI, video audio, and Flow notes derive from one deterministic Performance Plan; comparison A+B audio and a shared sample-index TimeMap do not exist. |
| Video | PARTIAL | Standard template, three visual styles, AVFoundation encoding, exact end boundary, and Flow note sidecar exist; compare template, scene parity, cancellation, validation states, and final-file validation do not. |
| Design/brand | PARTIAL | Official app/video icons, design tokens, Noto Sans JP, and frozen renderers exist; no standalone official wordmark image exists. |
| Billing | PARTIAL | Billing Provider/RevenueCat and active `palette_pro` entitlement exist; comparison/export policy after expiry and server authority are not implemented. |
| Analytics | PARTIAL | Anonymous PostHog abstraction and existing Evolution/export events exist; event IDs, job idempotency, first-success/reuse/cancel/share events, and durable dedupe do not. |
| Share | PARTIAL | MP4 and MIDI can open the iOS share sheet; project manifests, import, share links, ownership, revoke, Web preview, and Universal Links do not. |
| Operations | PARTIAL | Feature flags, EAS profiles, tests, Freeze gates, and historical device acceptance exist; growth flags, current Flow device proof, minimum benchmark device, and rollback runbook do not. |

## 1. Project audit

### Existing data

The persisted `Project` contract is in `src/types/index.ts`. It contains:

- local `id`
- title
- tonic/key mode
- integer BPM
- `timeSignature`
- instrument, groove, accompaniment, variant, and Energy
- per-chord voicing and `ChordEvent[]`
- creation/update epoch timestamps

`ChordEvent` is the normalized placed-harmony event used by the editor. Its timing
unit is `durationBeats`, currently restricted by the public type to `1 | 2 | 4`.
It carries stable placement ID, harmonic symbol fields, optional slash bass,
key/mode context, category, and voicing.

Project IDs are generated locally as
`p-${Date.now().toString(36)}-${Math.random()...}` in
`src/repositories/projectRepository.ts`. They are suitable as local row IDs, but not
as public opaque share tokens or canonical revision IDs.

The persisted project type declares `TimeSignature = '4/4'`. Performance meter may
still be remetered from the selected accompaniment through
`beatsPerBarFor()` in
`src/lib/performance/finalMidi/buildSessionPerformancePlan.ts`. CP-1 must use the
actual Performance Plan meter and must not assume that the persisted field alone is
the rendered meter.

### Existing lifecycle

- `createProject`, `saveProject`, `getProject`, `listProjects`, and
  `deleteProject` use local SQLite through
  `src/repositories/projectRepository.ts`.
- `duplicateProject` creates an independent local copy with a new ID.
- `src/features/editor/useAutosave.ts` updates already-saved projects after a
  700 ms debounce. A new session requires an explicit first save.
- `src/features/editor/session.ts` keeps a process-memory `history` of progression
  arrays. `replaceProgressionAtomically()` adds exactly one entry and `undo()` pops
  one entry.
- SQLite migrations in `src/lib/db.ts` are additive columns with defaults.

### Gaps

- No `ProjectRevision`, baseline/original revision, adopted revision, parent copy
  reference, schema version, or immutable export snapshot is persisted.
- Undo history is not persisted and stores only progression arrays, not the complete
  Project/audio configuration.
- There is no canonical serializer or snapshot fingerprint.
- Preview does not create a saved revision, which is correct and must be preserved.
- Existing rows cannot be assumed to have an original. CP-3 must not fabricate one.

## 2. Evolution audit

### Public and accepted state

`docs/acceptance/phase-4-l3-ios-device-acceptance.md` records a PASS for L3 on an
iPhone, including non-destructive Preview, Pro-gated Apply, Atomic Apply, and
single-step Undo. The baseline code contains L1-L3.

The user-facing entry remains disabled by default:
`src/config/featureFlags.ts` enables it only when
`EXPO_PUBLIC_CHORD_EVOLUTION_ENABLED=true`.

The original workspace's L4 files and
`docs/acceptance/phase-5-l4-modal-interchange-acceptance.md` are uncommitted and are
not part of this baseline. Their domain acceptance does not establish a released or
device-accepted L4 UI.

### Candidate and apply contracts

`src/lib/harmony/evolution/types.ts` provides:

- candidate `before`, `after`, and typed `changes`
- replacement and `insert_before`
- deterministic technique and evidence metadata
- `requiredTier: 'FREE' | 'PRO'`
- stable event IDs and explicit scope

`src/features/editor/chordEvolution/preview.ts` materializes a copied candidate
progression and builds the normal production playback request without writing to the
Editor Session.

`src/features/editor/chordEvolution/apply.ts` prepares against the exact progression
reference and applies the complete result through one
`replaceProgressionAtomically()` transaction.

L1/L2 replacement materialization rejects stale baselines, length/order changes,
duration changes, and total-beat changes. L3 insertion may add one event by splitting
the previous event's duration; total beats remain unchanged. This distinction is
already explicit and is reusable by a comparison-compatibility validator.

### Original retention gap

After successful Apply, `useChordEvolution.ts` stores only an in-memory marker needed
to classify the next Undo analytics event. The original progression remains only in
the generic session history. There is no durable or export-facing base/variant pair.

Therefore CP-1 must capture immutable base and variant snapshots at an application
boundary. It must not temporarily mutate the Editor to render A and then restore it.

## 3. Audio and timing audit

### Exact performance source

The shared entry point is:

```text
Editor or export snapshot
  -> buildSessionPerformancePlan
  -> SessionPerformancePlan
  -> buildFinalMidiSnapshot
  -> buildNativePlaybackPlan
  -> NativeMidiEvent[]
```

`buildSessionPerformancePlan()` in
`src/lib/performance/finalMidi/buildSessionPerformancePlan.ts` resolves meter,
voicing, deterministic seed, Style/variant, Energy, tier strength, human template,
microtiming, velocity, articulation, release behavior, and harmony validation once.

`SessionPerformancePlan` contains final performance `NoteEvent[]`, remetered chords,
source progression, BPM, total beats, meter, instrument, drum mode, Energy-derived
performance result, and seed. A `NoteEvent` carries beat time, duration, pitch,
velocity, articulation, track ID, seed, and optional anticipation ownership.

`buildFinalMidiSnapshot()` includes `chord`, `top`, and `bass` as accompaniment,
adds deterministic drum events, and supplies marker and CC64 data. Playback and
video audio flatten the same snapshot to ordered MIDI on/off/CC events.

### Offline render

`modules/chord-audio/ios/OfflineMidiRenderer.swift`:

- renders at 48,000 Hz, stereo
- converts each event beat directly to a rounded integer sample frame
- clamps negative microtimed events to frame zero
- renders bounded chunks of at most 4096 frames
- writes AAC/M4A and returns the real sample rate
- renders exactly `round(durationSec * sampleRate)` frames

Count-in is a playback-only field. It is added by `editorPlaybackRequest()` and is
never part of Final MIDI or the video `RenderAudioRequest`. CP-1/2 must not modify
Count-in to implement comparison output.

### Timing gaps for comparison

- `RenderAudioResult.sampleRate` is returned to TypeScript, but
  `src/services/videoExport/index.ts` currently discards it.
- No A+B audio request or immutable pair of Performance Plans exists.
- No common sample-index TimeMap represents Story segments and Visual cues.
- The current native writer decodes the 48 kHz M4A and re-encodes the MP4 audio track
  as 44.1 kHz AAC. Decoded final media sync must be measured; source frame agreement
  alone is insufficient.
- `harmonyTargetChordIndex` is available for some anticipated performance notes,
  but no general event-to-harmony ownership contract has been proven for every style.
  Initial comparison cues should use harmony boundaries unless an observed chord/top
  attack can be attributed safely.

## 4. Video audit

### Existing Standard template

The current data path is:

```text
src/app/export.tsx
  -> videoExportService.exportAndSave / exportAndShare
  -> buildSessionPerformancePlan
  -> buildVideoAudioRequest
  -> audioService.renderAudioFile
  -> buildExportPlan
  -> ChordVideoExportNative.exportVideo
  -> VideoFrameRendererRegistry
  -> VideoWriter
  -> Photos or iOS share sheet
```

The defaults are 1080 x 1920, 30 fps, H.264 video, and AAC audio. Export duration is
one exact Performance Plan cycle. `VideoWriter.swift` uses integer frame index for
PTS and a 600,000-timescale `endTime` for both the audio reader and writer session,
avoiding accumulated PTS addition and clipping both tracks to one boundary.

`ExportPlan.segments` supplies chord-level start and duration times. At the Falling
Block baseline, Flow additionally receives `visualNoteEvents` derived read-only from
the same `SessionPerformancePlan`; only `chord` and `top` tracks are included.
Classic and Pulse payloads omit this sidecar.

### Renderer state

- Classic is the accepted production baseline.
- Pulse has an accepted independent renderer and frozen PNG baselines.
- Flow has an independent renderer. Commit `0e27280` changes it to Performance
  Falling Blocks with chord-level segments and note-level sidecar timing.
- `docs/video_style_expansion_audit.md` already distinguishes visual style from a
  future video template and explicitly identifies comparison/evolution as content
  composition, not visual style.
- `docs/roadmap/2026-09/07_shorts_video_templates.md` already proposes
  `VideoTemplateId` with Standard, Evolution, and Comparison. CP-1/2 should refine
  this extension point instead of adding Compare to `VideoVisualStyle`.

### Existing normal-video evidence

`docs/acceptance/phase-v3-pulse-renderer-acceptance.md` records an accepted Standard
template/Pulse-style MP4:

- source filename:
  `chord-video-FDF0DEB6-A436-45CA-96D2-94CACF031D06.MP4`
- H.264, 720 x 1280, 30 fps, 222 frames, 7.400 seconds
- AAC, 44.1 kHz stereo, 7.384603 seconds
- fixture: `Cadd9 | Fmaj7 | Gsus4 | Cadd9`, BPM 130
- EAS build: `16f12402-a85b-4e79-ba35-65b556a14b82`

Six reviewed PNGs and their SHA-256 values remain in the repository and were
re-hashed during CP-0. The source MP4 itself is not in the repository, and CP-0 did
not produce a fresh device export. Thus historical existence is `EXISTING`; current
device replay from this commit is `UNKNOWN`.

### Missing CP-2 behavior

- No `standard | compare` template selector or Compare renderer exists.
- The React Native preview uses its own JS timer and simplified composition. It is
  documented as not being a pixel-accurate native oracle. FR-07 is not met.
- UI state is only `idle | save | share` plus encode progress. There is no
  validating/preparing/rendering/muxing/ready model or job ID.
- Busy state blocks repeated taps, but native/audio cancellation is not implemented.
- Temporary audio/video cleanup on failure/cancel is not explicit.
- No free-space preflight, memory warning policy, interruption contract, or completed
  MP4 codec/dimension/duration/track validation exists.
- Photo permission failure and share unavailability return retryable user errors.
  Save and share are distinct, which is reusable.

## 5. Design and brand audit

The official assets and their uses are documented in
`docs/design/app-icons.md`.

- iOS app icon: `assets/icon/app-icon.png`
- in-app transparent icon: `assets/icon/icon.png`
- native video icon: `modules/chord-video-export/ios/assets/cp-watermark.png`
- Pro icon: `assets/icon/app-icon-pro.png`

No standalone repository-owned official wordmark image exists.

Classic's frozen native renderer and the current React Native preview construct a
textual `Chord Palette` lockup. Flow deliberately renders only the official icon
because its approved Phase V4 direction prohibited reconstructing a wordmark.

The new FR-10 requirement is not a reason to change frozen Flow. For a new Compare
template, the minimum compatible interpretation is official `cp-watermark.png` plus
a product-name text lockup using existing typography. Calling that text an official
wordmark requires explicit design approval; no image may be invented.

Noto Sans JP is an existing dependency. Existing color/font tokens live under
`src/theme/`. New Compare visuals must use these tokens through a versioned template
theme, not add video fields to Performance Energy profiles.

## 6. Billing and entitlement audit

`src/services/billing/` implements a Provider boundary:

- UI reads `billingService`, `useEntitlements()`, and `getTier()`.
- `RevenueCatBillingProvider` resolves the active `palette_pro` entitlement.
- offerings and localized prices come from RevenueCat.
- the provider prefers the current monthly package; annual purchase is not modeled.
- purchase, restore, lapse updates, and a safe disabled-provider fallback exist.
- `communityPlus` is independent and currently not sold.

Evolution candidate Preview is always available. Apply checks `requiredTier` through
`evolutionCandidateAccess()`: L1 is Free, while Rich/Reharm candidates are Pro.

Gaps:

- The exact live App Store product identifier and localized price are runtime store
  configuration and were not verified in CP-0. The analytics label
  `palette_pro_monthly` is not proof of the store product identifier.
- The client entitlement is explicitly provisional; no Convex/server verification
  implementation exists.
- Pending, refund, billing grace period, durable offline entitlement policy, and
  purchase-webhook idempotency are not modeled in this repository.
- It is unresolved whether an expired Pro user may export a previously saved work
  containing Pro harmony. CP-1 must preserve existing access promises and cannot
  delete or simplify that work.
- The proposed ¥780/month and ¥6,800/year are CP-5 hypotheses only. CP-0 does not
  authorize product or price changes.

## 7. Analytics audit

`src/services/analytics/index.ts` is a thin PostHog abstraction. It lazy-loads only
for configured non-development builds, uses anonymous PostHog identity, rejects
project titles/chord progressions/video content by policy, and never throws into
product code.

Existing useful events include Evolution open/preview/apply/undo/paywall and video
export start/complete/fail. Billing events exist for paywall, purchase, and restore.

Missing growth guarantees:

- event schema/version, event ID, occurrence time, and durable install/session IDs
- once-only `first_play` and `first_creation_completed`
- `project_saved` and `saved_project_reused`
- export job ID and terminal-event deduplication
- `video_export_cancelled` and `share_sheet_opened`
- renewal, expiration, refund, and server transaction deduplication
- offline event queue/retention evidence and an explicit analytics consent surface

Existing event names should be extended through the same service. Native and JS must
not both emit the same logical terminal event.

## 8. Share audit

Existing:

- MP4 export can open the iOS share sheet.
- MIDI export writes a local `.mid` file and opens the iOS share sheet.
- `expo-linking` is installed and app scheme `chordpalette` is configured through
  Expo Router.

Missing:

- versioned Project/share manifest
- strict import validation and preview
- import-as-copy with a new local ID
- share token, short code, ownership, revoke, expiry, report, and abuse controls
- Convex/backend implementation, auth implementation, Web listening page
- Associated Domains, AASA file, owned production domain, and tested Universal Links

`convexUrl` and `clerkPublishableKey` are environment placeholders only. No
`convex/`, auth service, or share repository implementation was found.

CP-4b is therefore `BLOCKED` until CP-4a is complete and backend/domain/owner
management/operations are explicitly approved. A mock must not be reported as a
complete backend.

## 9. Operations and release audit

Existing:

- EAS development, preview, and production profiles in `eas.json`
- local app version/build configuration in `app.json`
- TypeScript, lint, Jest, quality, MIDI, and audition scripts
- architecture and Freeze tests for Classic, Pulse, and Flow
- historical L3 and Pulse iOS device acceptance records
- production RevenueCat/PostHog client configuration in EAS profiles

Partial or unknown:

- Growth-specific flags do not exist. Only metronome and chord Evolution flags exist.
- No minimum supported iPhone/iOS or low-performance benchmark device is recorded in
  the inspected app/module configuration.
- Current EAS build-credit availability is external and unknown.
- Falling Block Flow needs a new EAS build and physical-device acceptance.
- The known Web `expo-sqlite`/WASM issue is unrelated and must not be fixed as part
  of CP-0/1/2.
- No growth migration/rollback runbook or output-job diagnostics exists yet.

## 10. Proposed CP-1 contract boundary

The architecture decision is additive:

```text
Editor Session + selected EvolutionCandidate
  -> immutable base/variant export snapshots
  -> semantic HarmonyChange[]
  -> compare compatibility result
  -> two frozen SessionPerformancePlans
  -> sample-index CompareTimePlan
       -> A+B audio request
       -> shared scene manifest
            -> React Native preview adapter
            -> native Compare renderer
```

Rules:

1. Snapshot creation copies nested Project and chord data and never edits Session.
2. The selected candidate is materialized with the existing validated adapter.
3. V1 accepts equal meter, BPM, key, Style, Energy, instrument, audio settings, and
   total beat length.
4. Insertion is distinguished from replacement. An insertion may preserve total
   beats, but initial “same-position/one-change” copy is not used unless semantic
   alignment is proven.
5. Both Performance Plans are built once and frozen for the export job.
6. `RenderAudioResult.sampleRate` becomes an explicit TimeMap input.
7. Chord boundaries and observed performance attacks are separate cue sources.
8. Video selection never changes notes, BPM, key, Style, Energy, or tier.
9. Standard export keeps its existing default and payload.

Detailed proposed types, extension points, files, and tests are recorded in
`docs/implementation/chord-palette-growth-plan.md`.

## 11. Freeze proof

The following baseline Git blob IDs were recorded before CP-0 documentation:

| Frozen file | Git blob |
|---|---|
| `modules/chord-video-export/ios/FrameRenderer.swift` | `26e2d17f8946ec5d713d9856e15c48e94d2824e4` |
| `modules/chord-video-export/ios/ClassicFrameRendererAdapter.swift` | `cb01605fcd82bfba82184a972ca8c0fa02a3f551` |
| `modules/chord-video-export/ios/PulseFrameRenderer.swift` | `8d7d7343e4b6bf20d2a7c3f081bc62bfbd61f819` |
| `modules/chord-video-export/ios/PulseFrameState.swift` | `498c34af24dda1d98bd6fb19dbf8e0aef8c0bdcc` |
| `modules/chord-video-export/ios/VideoWriter.swift` | `4adcb1cb90374cfbd00c2788206548aac5aba22f` |

CP-0 changes none of these files. CP-2 planning treats `VideoWriter` and all existing
renderers as compatibility boundaries. A future inability to implement cancellation
without changing `VideoWriter` must be raised as a separate approval request with a
minimal protocol change and Standard regression proof.

## 12. Specification changes and conflicts

1. The growth document introduces Compare as a first-class output composition.
   Existing video phases used V1-V4 for visual-style work. Growth phases must be
   called CP-0-CP-5 and the first Compare template must be `compare-v1`, not “Phase
   V1”, in code and acceptance records.
2. Existing Flow is a visual style; Compare is a template/story mode. Combining them
   into one enum would cause Standard behavior and preference migration risk.
3. The approved older Flow direction said segment timing only. The later approved
   Falling Block revision intentionally added a read-only Final Performance note
   sidecar. CP-0 uses the later implementation as current Flow and does not reopen
   Classic/Pulse.
4. FR-07 is new behavior. The current simplified app preview cannot be claimed to
   match native output at the same timestamp.
5. FR-10 asks for icon plus product name, while approved Flow has icon-only branding.
   The new lockup is scoped to Compare and needs design acceptance; Flow remains
   unchanged.
6. FR-11 cancellation/resource recovery exceeds current writer behavior. It may
   eventually require a separately approved native protocol extension.
7. Persistent original/adopted revisions are new schema behavior and belong to CP-3,
   not an implicit rewrite during CP-1.
8. Shared-link backend, Universal Links, and pricing changes remain out of CP-0-CP-3.

## 13. Unresolved questions and blockers

| Item | Status | Recommended handling |
|---|---|---|
| Compare source lifetime after Apply | Design decision for CP-1 | Capture an immutable draft only after successful Apply; invalidate it when the current project no longer matches its variant fingerprint. Persist revisions only in CP-3. |
| Pro content after subscription expiry | BLOCKED on product promise | Preserve saved work and existing playback behavior; do not delete or downgrade. Decide separately whether new compare export is allowed. |
| Product-name lockup status | BLOCKED on design acceptance | Use official icon plus existing product typography in Compare only; do not call it an image wordmark or modify Flow. |
| Benchmark iPhone/iOS | UNKNOWN | Record the registered test device before CP-2 performance acceptance. |
| Current EAS capacity | UNKNOWN | Check only when a native CP-2 build is approved and ready. |
| Falling Block device acceptance | BLOCKED on EAS/device test | Keep automated result separate; do not block pure CP-1 contracts, but require current native baseline proof before CP-2 sign-off. |
| L4 availability | BLOCKED on commit/UI acceptance | Initial Compare supports baseline L1-L3; add L4 only after its branch and release state are approved. |
| General attack-to-harmony ownership | PARTIAL | Initial V1 uses harmony boundaries; enable attack FX only for attributable chord/top events and test anticipation separately. |
| Source MP4 availability | UNKNOWN | Existing acceptance metadata and PNGs are retained; archive a fresh CP-2 baseline MP4 during device acceptance. |

## 14. CP-0 approval state

Approved and completed by this document:

- repository and branch audit
- existing capability classification
- exact Project/Evolution/Performance/Audio/Video path description
- initial compare contract boundary
- test and phase-plan preparation
- Freeze and out-of-scope identification

Not approved:

- CP-1 production implementation
- DB migrations or Project revision persistence
- Compare UI/native renderer
- changes to Performance Engine or Energy profiles
- billing products or prices
- backend, domain, Web page, Universal Links, or public release
- EAS build, App Store submission, SNS posting, or third-party contact
