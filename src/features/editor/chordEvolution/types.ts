import type { ChordEvent } from '@/types';

export type EvolutionAdapterFailureReason =
  | 'STALE_BASELINE'
  | 'LENGTH_CHANGED'
  | 'UNKNOWN_EVENT_ID'
  | 'EVENT_ORDER_CHANGED'
  | 'DURATION_CHANGED'
  | 'TOTAL_BEATS_CHANGED'
  | 'UNSUPPORTED_CANDIDATE'
  | 'UNSUPPORTED_CHANGE_KIND'
  | 'INVALID_CHANGE_SET'
  | 'NO_CHANGES'
  | 'SESSION_CHANGED';

export type EvolutionAdapterFailure = {
  readonly ok: false;
  readonly reason: EvolutionAdapterFailureReason;
  readonly detail?: string;
};

export type EvolutionAdapterResult<T> =
  { readonly ok: true; readonly value: T } | EvolutionAdapterFailure;

export type AtomicProgressionPatch = {
  /** Exact session progression reference observed while preparing the patch. */
  readonly expectedCurrent: readonly ChordEvent[];
  readonly progression: readonly ChordEvent[];
  readonly selected: number;
};

export type EvolutionApplyResult =
  | {
      readonly status: 'APPLIED';
      readonly historyEntriesAdded: 1;
    }
  | {
      readonly status: 'REJECTED';
      readonly reason: EvolutionAdapterFailureReason;
      readonly detail?: string;
    };
