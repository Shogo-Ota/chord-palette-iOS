import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { ComparisonDraft } from '@/features/editor/chordEvolution';
import { getSession, startNew } from '@/features/editor/session';
import { compareCompatibility, semanticHarmonyDiff } from '@/lib/comparison';
import { comparisonSource, snapshot } from '@/lib/comparison/testing/fixtures';
import { track } from '@/services/analytics';
import { videoExportService } from '@/services/videoExport';
import { buildCompareExportPlan } from '@/services/videoExport/buildCompareExportPlan';

import { useCompareVideoExport } from '../useCompareVideoExport';

const mockResolveComparisonDraft = jest.fn();

jest.mock('@/features/editor/chordEvolution', () => {
  const actual = jest.requireActual('@/features/editor/chordEvolution');
  return {
    ...actual,
    resolveComparisonDraft: (...args: unknown[]) => mockResolveComparisonDraft(...args),
  };
});

jest.mock('@/repositories/videoMotionPreferenceRepository', () => ({
  getVideoMotionPreference: jest.fn(async () => 'standard'),
  setVideoMotionPreference: jest.fn(async () => undefined),
}));

jest.mock('@/services/analytics', () => ({
  track: jest.fn(),
}));

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
    draftId: 'draft-hook',
    candidateId: 'candidate-hook',
    requiredTier: 'FREE',
    base,
    variant,
    changes: semanticHarmonyDiff(base, variant),
    compatibility: compareCompatibility(base, variant),
  };
}

describe('useCompareVideoExport', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    (track as jest.Mock).mockClear();
    mockResolveComparisonDraft.mockReset();
    startNew();
  });

  it('prepares once, blocks repeated starts and records one terminal result', async () => {
    const comparisonDraft = draft();
    mockResolveComparisonDraft.mockReturnValue({
      status: 'available',
      draft: comparisonDraft,
    });
    const prepared = await buildCompareExportPlan(
      {
        draft: comparisonDraft,
        tier: 'free',
        motion: 'standard',
        watermark: true,
      },
      {
        renderAudioFile: jest.fn(async () => ({
          uri: 'file:///compare.wav',
          sampleRate: 48_000,
        })),
      },
    );
    const prepare = jest
      .spyOn(videoExportService, 'buildCompareExportPlan')
      .mockResolvedValue(prepared);
    const encode = jest
      .spyOn(videoExportService, 'exportPreparedCompareToFile')
      .mockResolvedValue('file:///compare.mp4');
    const save = jest.spyOn(videoExportService, 'saveToPhotos').mockResolvedValue();
    jest.spyOn(videoExportService, 'disposePreparedCompareExport').mockResolvedValue();

    const view = renderHook(() =>
      useCompareVideoExport({
        session: getSession(),
        tier: 'free',
        visualStyle: 'classic',
        enabled: true,
        watermark: true,
        title: 'Compare',
      }),
    );
    act(() => view.result.current.selectTemplate('compare'));
    await waitFor(() => expect(view.result.current.job.phase).toBe('prepared'));
    expect(prepare).toHaveBeenCalledTimes(1);

    let outcomes: boolean[] = [];
    await act(async () => {
      outcomes = await Promise.all([
        view.result.current.run('save'),
        view.result.current.run('save'),
      ]);
    });
    expect(outcomes).toEqual([true, false]);
    expect(encode).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('file:///compare.mp4');
    expect(view.result.current.job.phase).toBe('saved');
    expect(
      (track as jest.Mock).mock.calls.filter(([event]) => event === 'video_export_completed'),
    ).toHaveLength(1);
  });

  it('keeps Compare unavailable without an exact draft', () => {
    mockResolveComparisonDraft.mockReturnValue({
      status: 'missing',
    });
    const view = renderHook(() =>
      useCompareVideoExport({
        session: getSession(),
        tier: 'free',
        visualStyle: 'classic',
        enabled: true,
        watermark: true,
        title: 'Compare',
      }),
    );
    act(() => view.result.current.selectTemplate('compare'));
    expect(view.result.current.template).toBe('standard');
    expect(view.result.current.compareEnabled).toBe(false);
  });
});
