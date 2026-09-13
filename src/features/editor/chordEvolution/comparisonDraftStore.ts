import type { EditorSession } from '@/features/editor/session';
import {
  compareCompatibility,
  createComparisonSnapshot,
  semanticHarmonyDiff,
  type CompareCompatibility,
  type CompareUnsupportedReason,
  type ComparisonSnapshotSource,
  type CreationSnapshotV1,
  type HarmonyChangeV1,
  type SnapshotFailureReason,
} from '@/lib/comparison';
import type { EvolutionCandidate } from '@/lib/harmony/evolution';

import { materializeEvolutionCandidateProgression } from './candidateMaterializer';
import type { EvolutionAdapterFailureReason } from './types';

export type ComparisonDraft = Readonly<{
  schemaVersion: 1;
  draftId: string;
  candidateId: string;
  requiredTier: 'FREE' | 'PRO';
  base: CreationSnapshotV1;
  variant: CreationSnapshotV1;
  changes: readonly HarmonyChangeV1[];
  compatibility: CompareCompatibility;
}>;

export type PrepareComparisonDraftResult =
  | { readonly ok: true; readonly value: ComparisonDraft }
  | {
      readonly ok: false;
      readonly reason: EvolutionAdapterFailureReason | SnapshotFailureReason;
      readonly detail?: string;
    };

export type ComparisonDraftResolution =
  | { readonly status: 'missing' }
  | { readonly status: 'stale'; readonly draft: ComparisonDraft }
  | {
      readonly status: 'unsupported';
      readonly draft: ComparisonDraft;
      readonly reason: CompareUnsupportedReason;
    }
  | { readonly status: 'available'; readonly draft: ComparisonDraft };

function sourceFromSession(
  session: Readonly<EditorSession>,
  progression: ComparisonSnapshotSource['progression'] = session.progression,
): ComparisonSnapshotSource {
  return {
    sourceProjectId: session.projectId,
    title: session.title,
    key: session.key,
    mode: session.mode,
    tempoBpm: session.tempoBpm,
    instrumentId: session.instrumentId,
    grooveId: session.grooveId,
    accompanimentPattern: session.accompanimentPattern,
    accompanimentVariant: session.accompanimentVariant,
    accompanimentEnergy: session.accompanimentEnergy,
    releaseCut: session.releaseCut,
    instrumentEffect: session.instrumentEffect,
    octaveShift: session.octaveShift,
    drumMode: session.drumMode,
    drumBeat: session.drumBeat,
    progression,
  };
}

export function prepareComparisonDraft(
  session: Readonly<EditorSession>,
  candidate: EvolutionCandidate,
): PrepareComparisonDraftResult {
  const materialized = materializeEvolutionCandidateProgression(session, candidate);
  if (!materialized.ok) return materialized;

  const baseResult = createComparisonSnapshot(sourceFromSession(session));
  if (!baseResult.ok) return baseResult;
  const variantResult = createComparisonSnapshot(sourceFromSession(session, materialized.value));
  if (!variantResult.ok) return variantResult;

  const base = baseResult.value;
  const variant = variantResult.value;
  const changes = semanticHarmonyDiff(base, variant);
  const compatibility = compareCompatibility(base, variant);
  return {
    ok: true,
    value: Object.freeze({
      schemaVersion: 1,
      draftId: `comparison-v1-${candidate.id}-${base.sourceRevision}-${variant.sourceRevision}`,
      candidateId: candidate.id,
      requiredTier: candidate.requiredTier,
      base,
      variant,
      changes,
      compatibility,
    }),
  };
}

let currentDraft: ComparisonDraft | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function publishComparisonDraft(draft: ComparisonDraft): void {
  currentDraft = draft;
  emit();
}

export function clearComparisonDraft(): void {
  if (currentDraft === null) return;
  currentDraft = null;
  emit();
}

export function getComparisonDraft(): ComparisonDraft | null {
  return currentDraft;
}

export function subscribeComparisonDraft(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resolveComparisonDraft(
  session: Readonly<EditorSession>,
): ComparisonDraftResolution {
  const draft = currentDraft;
  if (!draft) return { status: 'missing' };

  const current = createComparisonSnapshot(sourceFromSession(session));
  const sourceProjectMatches =
    draft.variant.sourceProjectId === null ||
    (current.ok && current.value.sourceProjectId === draft.variant.sourceProjectId);
  if (
    !current.ok ||
    !sourceProjectMatches ||
    current.value.sourceRevision !== draft.variant.sourceRevision
  ) {
    return { status: 'stale', draft };
  }
  if (!draft.compatibility.supported) {
    return {
      status: 'unsupported',
      draft,
      reason: draft.compatibility.reason,
    };
  }
  return { status: 'available', draft };
}
