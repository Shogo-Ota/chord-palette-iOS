import type { CompareSceneManifestV1, CompareSceneState } from './sceneContracts';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function evaluateCompareScene(
  manifest: CompareSceneManifestV1,
  sample: number,
): CompareSceneState | null {
  if (manifest.cues.length === 0 || manifest.timePlan.durationSamples <= 0) {
    return null;
  }

  const boundedSample = clamp(
    Math.floor(Number.isFinite(sample) ? sample : 0),
    0,
    manifest.timePlan.durationSamples - 1,
  );
  let cue = manifest.cues[0]!;
  for (const candidate of manifest.cues) {
    if (candidate.startSample > boundedSample) break;
    cue = candidate;
  }

  const upcoming = manifest.cues.find(
    (candidate) =>
      candidate.changed &&
      candidate.anticipationStartSample < candidate.startSample &&
      boundedSample >= candidate.anticipationStartSample &&
      boundedSample < candidate.startSample,
  );
  const page =
    manifest.pages.find(
      (candidate) => candidate.role === cue.role && candidate.pageIndex === cue.pageIndex,
    ) ?? manifest.pages[0];
  if (!page) return null;

  const revealWindow = Math.min(
    Math.round(manifest.timePlan.sampleRate * 0.24),
    Math.round(cue.durationSamples * 0.5),
  );
  const revealProgress =
    cue.changed && cue.role === 'variant' && revealWindow > 0
      ? clamp((boundedSample - cue.startSample) / revealWindow, 0, 1)
      : 1;

  return Object.freeze({
    sample: boundedSample,
    role: cue.role,
    cue,
    page,
    anticipating: upcoming != null,
    anticipatedCue: upcoming ?? null,
    revealProgress:
      manifest.motion === 'reduced' && cue.changed ? Number(revealProgress > 0) : revealProgress,
    storyProgress: boundedSample / manifest.timePlan.durationSamples,
  });
}

export function frameIndexToSample(manifest: CompareSceneManifestV1, frameIndex: number): number {
  const numerator = manifest.timePlan.fpsNumerator;
  const denominator = manifest.timePlan.fpsDenominator;
  return Math.floor(
    (Math.max(0, frameIndex) * manifest.timePlan.sampleRate * denominator) / numerator,
  );
}
