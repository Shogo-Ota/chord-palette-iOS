import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { resolveComparisonDraft, type ComparisonDraft } from '@/features/editor/chordEvolution';
import type { EditorSession } from '@/features/editor/session';
import { VideoExportError } from '@/lib/errors';
import type { VideoMotionPreference, VideoTemplateId } from '@/lib/videoExport/comparison';
import type { Tier } from '@/lib/performance/tier';
import { track } from '@/services/analytics';
import { videoExportService, type PreparedCompareExport } from '@/services/videoExport';
import { rebuildPreparedComparePresentation } from '@/services/videoExport/buildCompareExportPlan';
import type { VideoVisualStyle } from '@/services/videoExport/videoVisualStyle';

import {
  INITIAL_COMPARE_EXPORT_JOB,
  newCompareExportJobId,
  type CompareExportJobState,
} from './videoExportJob';
import { useVideoMotionPreference } from './useVideoMotionPreference';

type Props = {
  session: EditorSession;
  tier: Tier;
  visualStyle: VideoVisualStyle;
  enabled: boolean;
  watermark: boolean;
  title: string;
};

function comparisonReason(resolution: ReturnType<typeof resolveComparisonDraft>): string {
  if (resolution.status === 'missing') {
    return 'Evolution候補を適用すると、原型との聴き比べを作成できます。';
  }
  if (resolution.status === 'stale') {
    return '適用後に進行が変更されました。新しい候補を適用してください。';
  }
  if (resolution.status === 'unsupported') {
    return 'この変更は聴き比べV1の対象外です。通常動画は書き出せます。';
  }
  return '';
}

function messageFor(error: unknown): string {
  if (error instanceof VideoExportError) return error.userMessage;
  return '聴き比べ動画の準備に失敗しました。もう一度お試しください。';
}

export function useCompareVideoExport({
  session,
  tier,
  visualStyle,
  enabled,
  watermark,
  title,
}: Props) {
  const resolution = useMemo(() => resolveComparisonDraft(session), [session]);
  const draft: ComparisonDraft | null =
    enabled && resolution.status === 'available' ? resolution.draft : null;
  const [template, setTemplate] = useState<VideoTemplateId>('standard');
  const [prepared, setPrepared] = useState<PreparedCompareExport | null>(null);
  const [job, setJob] = useState<CompareExportJobState>(INITIAL_COMPARE_EXPORT_JOB);
  const preparingRef = useRef<Promise<PreparedCompareExport | null> | null>(null);
  const preparedRef = useRef<PreparedCompareExport | null>(null);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const terminalJobs = useRef(new Set<string>());
  const { motion, selectMotion: saveMotion } = useVideoMotionPreference(enabled);

  useEffect(() => {
    preparedRef.current = prepared;
  }, [prepared]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const current = preparedRef.current;
      if (current && !runningRef.current) {
        void videoExportService.disposePreparedCompareExport(current);
      }
    };
  }, []);

  useEffect(() => {
    if (!draft) {
      if (prepared) void videoExportService.disposePreparedCompareExport(prepared);
      setPrepared(null);
      setTemplate('standard');
    } else if (prepared && prepared.draftId !== draft.draftId) {
      void videoExportService.disposePreparedCompareExport(prepared);
      setPrepared(null);
      setTemplate('standard');
    }
  }, [draft, prepared]);

  useEffect(() => {
    if (
      prepared &&
      draft &&
      (prepared.scene.motion !== motion || prepared.scene.title !== title.trim())
    ) {
      setPrepared(rebuildPreparedComparePresentation(prepared, draft, motion, title));
    }
  }, [draft, motion, prepared, title]);

  const prepare = useCallback(async (): Promise<PreparedCompareExport | null> => {
    if (!draft) return null;
    if (prepared?.draftId === draft.draftId) return prepared;
    if (preparingRef.current) return preparingRef.current;

    setJob({ jobId: null, phase: 'validating', progress: 0, error: null });
    const work = (async () => {
      try {
        setJob({ jobId: null, phase: 'preparing', progress: 0, error: null });
        const value = await videoExportService.buildCompareExportPlan({
          draft,
          tier,
          motion,
          title,
          visualStyle,
          watermark,
        });
        if (!mountedRef.current) {
          await videoExportService.disposePreparedCompareExport(value);
          return null;
        }
        setPrepared(value);
        setJob({ jobId: null, phase: 'prepared', progress: 0, error: null });
        track('video_compare_prepared', {
          motion,
          changeCount: draft.changes.length,
        });
        return value;
      } catch (error) {
        setJob({
          jobId: null,
          phase: 'failed',
          progress: 0,
          error: messageFor(error),
        });
        return null;
      } finally {
        preparingRef.current = null;
      }
    })();
    preparingRef.current = work;
    return work;
  }, [draft, motion, prepared, tier, title, visualStyle, watermark]);

  const selectTemplate = useCallback(
    (value: VideoTemplateId) => {
      if (value === 'compare' && !draft) return;
      setTemplate(value);
      track('video_template_selected', { templateId: value });
      if (value === 'compare') void prepare();
    },
    [draft, prepare],
  );

  const selectMotion = useCallback(
    (value: VideoMotionPreference) => {
      saveMotion(value);
      if (prepared && draft) {
        setPrepared(rebuildPreparedComparePresentation(prepared, draft, value, title));
      }
    },
    [draft, prepared, saveMotion, title],
  );

  const run = useCallback(
    async (kind: 'save' | 'share'): Promise<boolean> => {
      if (runningRef.current) return false;
      if (job.phase === 'rendering' || job.phase === 'muxing' || job.phase === 'preparing') {
        return false;
      }
      runningRef.current = true;
      const value = prepared ?? (await prepare());
      if (!value) {
        runningRef.current = false;
        return false;
      }
      const jobId = newCompareExportJobId();
      setJob({ jobId, phase: 'rendering', progress: 0, error: null });
      track('video_export_started', {
        jobId,
        kind,
        templateId: 'compare',
        durationSec: value.plan.durationSec,
      });
      try {
        const options = {
          watermark,
          onProgress: (progress: number) => {
            setJob({
              jobId,
              phase: progress >= 1 ? 'muxing' : 'rendering',
              progress,
              error: null,
            });
          },
        };
        const uri = await videoExportService.exportPreparedCompareToFile(value, options);
        setJob({ jobId, phase: 'ready', progress: 1, error: null });
        if (kind === 'save') await videoExportService.saveToPhotos(uri);
        else await videoExportService.share(uri);
        if (!terminalJobs.current.has(jobId)) {
          terminalJobs.current.add(jobId);
          track(kind === 'save' ? 'video_export_completed' : 'video_share_sheet_opened', {
            jobId,
            templateId: 'compare',
          });
        }
        setJob({
          jobId,
          phase: kind === 'save' ? 'saved' : 'shareSheetOpened',
          progress: 1,
          error: null,
        });
        return true;
      } catch (error) {
        if (!terminalJobs.current.has(jobId)) {
          terminalJobs.current.add(jobId);
          track('video_export_failed', { jobId, templateId: 'compare', kind });
        }
        setJob({
          jobId,
          phase: 'failed',
          progress: 0,
          error: messageFor(error),
        });
        return false;
      } finally {
        runningRef.current = false;
        if (!mountedRef.current) {
          void videoExportService.disposePreparedCompareExport(value);
        }
      }
    },
    [job.phase, prepare, prepared, watermark],
  );

  return {
    template,
    selectTemplate,
    compareEnabled: draft != null,
    compareReason: enabled
      ? comparisonReason(resolution)
      : 'このビルドでは聴き比べを利用できません。',
    scene: prepared?.scene ?? null,
    motion,
    selectMotion,
    job,
    preparing: job.phase === 'validating' || job.phase === 'preparing',
    busy:
      job.phase === 'validating' ||
      job.phase === 'preparing' ||
      job.phase === 'rendering' ||
      job.phase === 'muxing' ||
      job.phase === 'ready',
    run,
    retryPrepare: prepare,
  };
}
