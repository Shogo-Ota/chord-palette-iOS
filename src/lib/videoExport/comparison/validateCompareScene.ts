import type { CompareSceneManifestV1, CompareSceneValidationResult } from './sceneContracts';

function safeNonNegative(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function validateCompareScene(
  manifest: CompareSceneManifestV1,
): CompareSceneValidationResult {
  if (
    manifest.schemaVersion !== 1 ||
    manifest.themeVersion !== 1 ||
    manifest.templateId !== 'compare' ||
    manifest.productName !== 'Chord Palette' ||
    (manifest.motion !== 'standard' && manifest.motion !== 'reduced')
  ) {
    return { ok: false, reason: 'INVALID_VERSION' };
  }
  const { timePlan } = manifest;
  if (
    timePlan.schemaVersion !== 1 ||
    !safeNonNegative(timePlan.durationSamples) ||
    timePlan.durationSamples <= 0 ||
    !safeNonNegative(timePlan.sampleRate) ||
    timePlan.sampleRate <= 0 ||
    timePlan.segments.length !== 2
  ) {
    return { ok: false, reason: 'INVALID_TIME_PLAN' };
  }
  const ids = [...manifest.pages.map((page) => page.id), ...manifest.cues.map((cue) => cue.id)];
  if (new Set(ids).size !== ids.length) {
    return { ok: false, reason: 'DUPLICATE_ID' };
  }
  if (
    manifest.pages.length === 0 ||
    manifest.pages.some(
      (page) =>
        page.cards.length === 0 ||
        page.cards.length > 4 ||
        page.pageIndex < 0 ||
        !Number.isInteger(page.pageIndex),
    )
  ) {
    return { ok: false, reason: 'INVALID_PAGE' };
  }

  let previousStart = -1;
  for (const cue of manifest.cues) {
    if (
      !safeNonNegative(cue.startSample) ||
      !safeNonNegative(cue.durationSamples) ||
      cue.durationSamples <= 0 ||
      !safeNonNegative(cue.anticipationStartSample) ||
      cue.anticipationStartSample > cue.startSample ||
      cue.startSample < previousStart ||
      cue.startSample + cue.durationSamples > timePlan.durationSamples
    ) {
      return { ok: false, reason: 'UNSAFE_SAMPLE', detail: cue.id };
    }
    if (
      !manifest.pages.some(
        (page) =>
          page.role === cue.role &&
          page.pageIndex === cue.pageIndex &&
          page.cards.some((card) => card.eventId === cue.eventId),
      )
    ) {
      return { ok: false, reason: 'INVALID_CUE', detail: cue.id };
    }
    previousStart = cue.startSample;
  }
  if (manifest.cues.length !== timePlan.harmonyEvents.length) {
    return { ok: false, reason: 'INVALID_CUE' };
  }
  return { ok: true };
}
