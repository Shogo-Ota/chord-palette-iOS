import type { ComparisonDraft } from '@/features/editor/chordEvolution';
import { compareCompatibility, semanticHarmonyDiff } from '@/lib/comparison';
import { comparisonSource, snapshot } from '@/lib/comparison/testing/fixtures';
import { buildCompareExportPlan } from '@/services/videoExport/buildCompareExportPlan';

function draft(): ComparisonDraft {
  const base = snapshot();
  const progression = comparisonSource().progression.map((event, index) =>
    index === 2
      ? {
          ...event,
          chordId: '5:minor',
          displayName: 'Fm',
          suffix: 'm',
          definitionId: 'minor',
        }
      : event,
  );
  const variant = snapshot({ progression });
  return {
    schemaVersion: 1,
    draftId: 'draft-1',
    candidateId: 'candidate-1',
    requiredTier: 'FREE',
    base,
    variant,
    changes: semanticHarmonyDiff(base, variant),
    compatibility: compareCompatibility(base, variant),
  };
}

describe('buildCompareExportPlan', () => {
  it('renders one combined A+B performance then uses the actual sample rate', async () => {
    const renderAudioFile = jest.fn(async () => ({
      uri: 'file:///compare.wav',
      sampleRate: 48_000,
    }));
    const result = await buildCompareExportPlan(
      {
        draft: draft(),
        tier: 'free',
        motion: 'standard',
        watermark: true,
        visualStyle: 'flow',
      },
      { renderAudioFile },
    );

    expect(renderAudioFile).toHaveBeenCalledTimes(1);
    expect(result.audioRequest.totalBeats).toBe(32);
    expect(result.audioRequest.durationSec).toBe(19.2);
    expect(result.audioRequest.midiEvents?.some((event) => event.beat >= 16)).toBe(true);
    expect(result.scene.timePlan.sampleRate).toBe(48_000);
    expect(result.scene.timePlan.durationSamples).toBe(921_600);
    expect(result.plan).toMatchObject({
      templateId: 'compare',
      durationSec: 19.2,
      audioUri: 'file:///compare.wav',
      compareScene: { schemaVersion: 1, templateId: 'compare' },
    });
  });

  it('fails closed before audio when the draft is unsupported', async () => {
    const invalid = draft();
    const renderAudioFile = jest.fn();
    await expect(
      buildCompareExportPlan(
        {
          draft: {
            ...invalid,
            compatibility: { supported: false, reason: 'IDENTICAL' },
          },
          tier: 'free',
          motion: 'reduced',
          watermark: true,
        },
        { renderAudioFile },
      ),
    ).rejects.toThrow('COMPARE_UNSUPPORTED:IDENTICAL');
    expect(renderAudioFile).not.toHaveBeenCalled();
  });
});
