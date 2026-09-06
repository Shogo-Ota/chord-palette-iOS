import { L3_INSERTION_POLICY, type SourceRef } from '@/lib/musicTheory';

import type { EvolutionRuleApplication } from '../../contracts';
import type {
  EvolutionCandidate,
  EvolutionChange,
  EvolutionContext,
  EvolutionRationaleCode,
  EvolutionTheoryLabel,
} from '../../types';
import { copyEvolutionChord, copyEvolutionScope } from '../chordCopies';
import type { L3Technique } from '../contracts';

const LABELS: Readonly<Record<L3Technique, EvolutionTheoryLabel>> = {
  secondary_dominant: 'SECONDARY_DOMINANT',
  passing_diminished: 'PASSING_DIMINISHED',
  tritone_substitute: 'TRITONE_SUBSTITUTE',
};

const RATIONALES: Readonly<Record<L3Technique, EvolutionRationaleCode>> = {
  secondary_dominant: 'SECONDARY_DOMINANT_RESOLUTION',
  passing_diminished: 'CHROMATIC_PASSING_DIMINISHED',
  tritone_substitute: 'TRITONE_DOMINANT_SUBSTITUTION',
};

function changeFingerprint(change: EvolutionChange): string {
  if (change.kind === 'replace') {
    return [
      'replace',
      change.index,
      change.after.chordId,
      change.after.symbol.definitionId ?? change.after.symbol.suffix,
    ].join(':');
  }
  return [
    'insert',
    change.index,
    change.inserted.chordId,
    change.inserted.symbol.definitionId ?? change.inserted.symbol.suffix,
  ].join(':');
}

function candidateId(
  context: EvolutionContext,
  technique: L3Technique,
  lane: number,
  change: EvolutionChange,
): string {
  return [
    'evolution',
    'l3',
    technique,
    context.tonic,
    context.mode,
    `lane-${lane}`,
    changeFingerprint(change),
  ].join(':');
}

function uniqueSources(application: EvolutionRuleApplication): readonly SourceRef[] {
  const candidates =
    application.change.kind === 'insert_before'
      ? [...application.theorySources, L3_INSERTION_POLICY.source]
      : [...application.theorySources];
  const seen = new Set<string>();
  return candidates.filter((source) => {
    const key = JSON.stringify(source);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function materializeChange(context: EvolutionContext, change: EvolutionChange) {
  const after = context.progression.map(copyEvolutionChord);
  if (change.kind === 'replace') {
    if (
      change.index < 0 ||
      change.index >= after.length ||
      after[change.index]?.eventId !== change.before.eventId
    ) {
      return null;
    }
    after[change.index] = copyEvolutionChord(change.after);
    return after;
  }

  const previous = context.progression[change.index - 1];
  const target = context.progression[change.index];
  if (
    !previous ||
    !target ||
    change.resizedPrevious.eventId !== previous.eventId ||
    change.inserted.eventId === previous.eventId ||
    context.progression.some((chord) => chord.eventId === change.inserted.eventId) ||
    change.resizedPrevious.durationBeats + change.inserted.durationBeats !== previous.durationBeats
  ) {
    return null;
  }
  after.splice(
    change.index - 1,
    1,
    copyEvolutionChord(change.resizedPrevious),
    copyEvolutionChord(change.inserted),
  );
  return after;
}

export function buildL3Candidate(
  context: EvolutionContext,
  technique: L3Technique,
  lane: number,
  application: EvolutionRuleApplication,
): EvolutionCandidate | null {
  if (
    context.level !== 'reharm' ||
    context.mode !== 'major' ||
    context.scope.kind !== 'progression'
  ) {
    return null;
  }
  const id = candidateId(context, technique, lane, application.change);
  const change: EvolutionChange =
    application.change.kind === 'insert_before'
      ? {
          ...application.change,
          inserted: {
            ...copyEvolutionChord(application.change.inserted),
            eventId: `${id}:event:${context.progression[application.change.index]?.eventId ?? 'missing'}:${application.change.index}`,
          },
        }
      : application.change;
  const after = materializeChange(context, change);
  if (!after) return null;

  return {
    id,
    level: 'reharm',
    technique,
    scope: copyEvolutionScope(context.scope),
    before: context.progression.map(copyEvolutionChord),
    after,
    changes: [change],
    requiredTier: 'PRO',
    theoryLabel: LABELS[technique],
    rationaleCode: RATIONALES[technique],
    score: { status: 'UNEVALUATED' },
    generationMethod: 'RULE_BASED',
    evidence: 'DESIGN_TARGET',
    theorySources: uniqueSources({ ...application, change }),
  };
}
