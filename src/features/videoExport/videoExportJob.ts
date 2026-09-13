export type CompareExportPhase =
  | 'idle'
  | 'validating'
  | 'preparing'
  | 'prepared'
  | 'ready'
  | 'rendering'
  | 'muxing'
  | 'saved'
  | 'shareSheetOpened'
  | 'failed';

export type CompareExportJobState = Readonly<{
  jobId: string | null;
  phase: CompareExportPhase;
  progress: number;
  error: string | null;
}>;

export const INITIAL_COMPARE_EXPORT_JOB: CompareExportJobState = Object.freeze({
  jobId: null,
  phase: 'idle',
  progress: 0,
  error: null,
});

export function newCompareExportJobId(): string {
  return `compare-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
