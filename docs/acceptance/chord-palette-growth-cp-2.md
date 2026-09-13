# CP-2 Compare Device Review Acceptance

- Status: EAS Preview ready for physical-device review
- Branch: `feature/cp2-compare-device-review`
- Base: `0d08af0`
- Implementation commit: `4587c2063be6f4f764b0f7b65a093b3c9bcd86bc`
- EAS profile: `preview` (internal distribution)
- EAS build: `793f6ab7-ea9e-446e-bb2e-0fa36ae66cf4` (FINISHED)
- Built commit: `4ef93720a0f9632106086df99ad5e3dae3f5d8eb`
- Install: https://expo.dev/accounts/shogoota/projects/chord-palette/builds/793f6ab7-ea9e-446e-bb2e-0fa36ae66cf4
- Device result: Not tested yet

## Scope

- Standard and Compare are independent video templates.
- Compare is available only from an exact, compatible CP-1 Comparison Draft.
- Compare renders one base cycle followed by one variant cycle.
- One combined Final MIDI schedule feeds one offline audio render.
- The returned audio sample rate owns the Compare TimePlan and scene manifest.
- React Native preview and the native Compare renderer consume the same manifest.
- Standard and reduced motion preserve the same semantic information.
- Official `cp-watermark.png` and the plain product name are the only Compare branding.

## Automated evidence

- `npm run typecheck`: PASS
- changed-scope ESLint: PASS (0 errors)
- Compare focused: PASS (8 suites / 31 tests)
- Evolution + existing Video Export + Compare: PASS (56 suites / 402 tests)
- full Jest: 215 suites / 2,974 tests PASS, 1 skipped
  - Known environment-only failures: 4 suites / 14 tests because untracked teacher
    fixtures `P1_A1.mid` and `P1_C12.mid` are absent.
- `git diff --check`: PASS
- Expo Preview public config: Evolution/Compare enabled; bundle `app.chordpalette`;
  build number 24.
- Standard missing-template fallback: PASS through the native default
  `templateId = "standard"` and architecture gate.
- Frozen native sources: PASS; unchanged from `0d08af0`.
  - `FrameRenderer.swift`: `feeeaba31983d4921955d41c0392c670503285626d37d6a7c5df8d2df42c854c`
  - `ClassicFrameRendererAdapter.swift`:
    `c20af4aa240f676caf184397c377d1aee603bc96669bebda126c9584da9e6154`
  - `PulseFrameRenderer.swift`: `e33231555b532b35d1c14c8a3add2d8983cf935b6cb3fa3eda743973e73f4885`
  - `PulseFrameState.swift`: `10c7dcb206f3c9a72e2d4710feff09a34cff5e3230244986555ca3e19296120b`
  - `FlowFrameRenderer.swift`: `0dff50bd36424634c393e16c3a3e7e1dbaca320080a01311cd3e6dd013be4c35`
  - `VideoWriter.swift`: `81b3fbf0def45a534ef2d87921cc5e04a9c9d7572de48190a2b84b04944bb17f`
- Fixed 100 BPM / 48 kHz fixture:
  - A duration: 460,800 samples
  - B start: 460,800 samples
  - total: 921,600 samples
  - frame 288 at 30 fps resolves to sample 460,800
  - changed-card anticipation is 14,400 samples (300 ms)

Native pixel Golden and Classic-relative export performance remain physical-device
checks. The Compare renderer bounds work to four cards per page and uses no blur,
particles or per-frame music generation.

The first attempt (`c0806744-8854-4b89-95cd-cedc93adea68`) was canceled at the
paid-usage gate. After explicit approval, the second build completed successfully.
Native Swift compilation, signing and IPA generation passed.

## Golden review points

Use the same four-chord fixture for every point:

1. start (`A / C`)
2. before changed position (`A / Am`)
3. anticipation before variant change
4. changed boundary (`B / Fm`, `F → Fm`)
5. post-change (`B / G`)
6. A/B boundary

Native PNG/MP4 evidence is pending the EAS Preview build. Pure state fixtures do not
claim native pixel equivalence.

## Physical iPhone checklist

- Apply a compatible Evolution replacement and open Video Export.
- Confirm Standard remains selected initially.
- Select Compare and wait for the real preparation state to complete.
- Confirm hook, A/B role, large current chord, NEXT, change label and progression cards.
- Confirm a five-to-eight chord progression paginates with at most four cards.
- Compare Standard and reduced motion.
- Save the Compare MP4 and play it from Photos with sound.
- Confirm A plays once, B starts at the expected boundary, and the changed chord display
  does not appear early or late by a visible amount.
- Confirm Save, Share and retry after a rejected permission.
- Return to Standard and confirm Classic, Pulse and Flow still export normally.
- Confirm Project progression, audio settings and Undo history were not modified.

Record device model, iOS version, EAS build ID, commit, output duration, export time and
observed failures. Do not mark this document PASS until the user reports the device
results.

## Deferred final CP-2 gate

The current native API exposes no cancellation handle. This review build does not show
a fake Cancel action and does not modify frozen `VideoWriter.swift`. True writer/audio
cancellation and temporary-video cleanup require a separately approved minimal native
change before final CP-2 PASS.
