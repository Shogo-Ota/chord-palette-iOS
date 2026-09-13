import type { ComparisonDraft } from '@/features/editor/chordEvolution';
import { snapshotToPerformanceInput } from '@/lib/comparison';
import { buildExportPlan } from '@/lib/exportPlan';
import type { Tier } from '@/lib/performance/tier';
import {
  buildCompareSceneManifest,
  buildCompareTimePlan,
  validateCompareScene,
  type CompareSceneManifestV1,
  type VideoMotionPreference,
} from '@/lib/videoExport/comparison';
import { audioService } from '@/services/audio';
import type { RenderAudioRequest, RenderAudioResult } from '@/services/audio/types';

import { buildCompareAudioRequest } from './buildCompareAudioRequest';
import { buildComparePerformance, type ComparePerformancePackage } from './buildComparePerformance';
import type { ExportPlan } from './types';
import { removeTemporaryVideoExportFile } from './validateExportedVideo';
import type { VideoVisualStyle } from './videoVisualStyle';

export type PreparedCompareExport = Readonly<{
  draftId: string;
  performance: ComparePerformancePackage;
  audio: RenderAudioResult;
  audioRequest: RenderAudioRequest;
  scene: CompareSceneManifestV1;
  plan: ExportPlan;
}>;

export type BuildCompareExportPlanInput = Readonly<{
  draft: ComparisonDraft;
  tier: Tier;
  motion: VideoMotionPreference;
  title?: string;
  visualStyle?: VideoVisualStyle;
  watermark: boolean;
}>;

export type BuildCompareExportPlanDependencies = Readonly<{
  renderAudioFile(request: RenderAudioRequest): Promise<RenderAudioResult | null>;
}>;

const DEFAULT_DEPENDENCIES: BuildCompareExportPlanDependencies = {
  renderAudioFile: (request) => audioService.renderAudioFile(request),
};

export async function buildCompareExportPlan(
  input: BuildCompareExportPlanInput,
  dependencies: BuildCompareExportPlanDependencies = DEFAULT_DEPENDENCIES,
): Promise<PreparedCompareExport> {
  if (!input.draft.compatibility.supported) {
    throw new Error(`COMPARE_UNSUPPORTED:${input.draft.compatibility.reason}`);
  }
  const performance = buildComparePerformance(input.draft, input.tier);
  if (!performance.ok) {
    throw new Error(`COMPARE_PERFORMANCE:${performance.reason}`);
  }
  const audioRequest = buildCompareAudioRequest(input.draft.base, performance.value);
  const audio = await dependencies.renderAudioFile(audioRequest);
  if (!audio) throw new Error('COMPARE_AUDIO_RENDER_FAILED');

  try {
    const time = buildCompareTimePlan({
      base: input.draft.base,
      variant: input.draft.variant,
      sampleRate: audio.sampleRate,
    });
    if (!time.ok) throw new Error(`COMPARE_TIME_PLAN:${time.reason}`);

    const scene = buildCompareSceneManifest({
      base: input.draft.base,
      variant: input.draft.variant,
      timePlan: time.value,
      changes: input.draft.changes,
      motion: input.motion,
      title: input.title,
    });
    const validation = validateCompareScene(scene);
    if (!validation.ok) {
      throw new Error(`COMPARE_SCENE:${validation.reason}`);
    }
    const durationSec = time.value.durationSamples / time.value.sampleRate;
    const variantInput = snapshotToPerformanceInput(input.draft.variant);
    const basePlan = buildExportPlan({
      progression: variantInput.progression,
      key: variantInput.key,
      bpm: variantInput.tempoBpm,
      title: scene.title,
      durationSec,
      audioUri: audio.uri,
      watermark: input.watermark,
      octaveShift: variantInput.octaveShift,
      beatsPerBar: input.draft.variant.beatsPerBar,
      visualStyle: input.visualStyle,
    });
    const plan: ExportPlan = {
      ...basePlan,
      templateId: 'compare',
      compareScene: scene,
    };

    return Object.freeze({
      draftId: input.draft.draftId,
      performance: performance.value,
      audio,
      audioRequest,
      scene,
      plan,
    });
  } catch (error) {
    await removeTemporaryVideoExportFile(audio.uri).catch(() => undefined);
    throw error;
  }
}

export function rebuildPreparedComparePresentation(
  prepared: PreparedCompareExport,
  draft: ComparisonDraft,
  motion: VideoMotionPreference,
  title?: string,
): PreparedCompareExport {
  if (prepared.draftId !== draft.draftId) {
    throw new Error('COMPARE_DRAFT_CHANGED');
  }
  const scene = buildCompareSceneManifest({
    base: draft.base,
    variant: draft.variant,
    timePlan: prepared.scene.timePlan,
    changes: draft.changes,
    motion,
    title,
  });
  const validation = validateCompareScene(scene);
  if (!validation.ok) throw new Error(`COMPARE_SCENE:${validation.reason}`);
  return Object.freeze({
    ...prepared,
    scene,
    plan: Object.freeze({
      ...prepared.plan,
      title: scene.title,
      compareScene: scene,
    }),
  });
}
