import { evaluateCompareScene, type CompareSceneManifestV1 } from '@/lib/videoExport/comparison';

export function comparePreviewStateAtElapsedSec(scene: CompareSceneManifestV1, elapsedSec: number) {
  const sample = Math.floor(Math.max(0, elapsedSec) * scene.timePlan.sampleRate);
  return evaluateCompareScene(scene, sample % scene.timePlan.durationSamples);
}
