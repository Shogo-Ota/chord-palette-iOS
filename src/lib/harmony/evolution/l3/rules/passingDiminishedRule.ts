import type {
  EvolutionRule,
  EvolutionRuleApplication,
  TechniqueSupportResult,
} from '../../contracts';
import type { EvolutionChord } from '../../types';
import { copyEvolutionChord } from '../chordCopies';

export const PASSING_DIMINISHED_RULE_ID = 'l3-passing-diminished';

const MODE_SUPPORT = {
  major: 'SUPPORTED',
  minor: 'UNSUPPORTED',
} as const;

function insertedEventId(previous: EvolutionChord, target: EvolutionChord): string {
  return `evolution:l3:passing-dim:${previous.eventId}:${target.eventId}`;
}

export const passingDiminishedRule: EvolutionRule = {
  id: PASSING_DIMINISHED_RULE_ID,
  technique: 'passing_diminished',
  level: 'reharm',
  modeSupport: MODE_SUPPORT,

  support(context, targetIndex, dependencies): TechniqueSupportResult {
    const resolutions =
      dependencies.passingDiminished?.resolvePassingDiminished(context, targetIndex) ?? [];
    return resolutions.length > 0
      ? { status: 'SUPPORTED', eligible: true, reason: 'ELIGIBLE' }
      : {
          status: MODE_SUPPORT[context.mode],
          eligible: false,
          reason:
            targetIndex >= 0 && targetIndex < context.progression.length
              ? 'CHORD_NOT_ELIGIBLE'
              : 'TARGET_OUT_OF_RANGE',
        };
  },

  generate(context, targetIndex, dependencies): readonly EvolutionRuleApplication[] {
    const previous = context.progression[targetIndex - 1];
    const target = context.progression[targetIndex];
    if (!previous || !target || !dependencies.passingDiminished) return [];

    return dependencies.passingDiminished
      .resolvePassingDiminished(context, targetIndex)
      .map((resolution) => ({
        change: {
          kind: 'insert_before' as const,
          index: targetIndex,
          inserted: {
            eventId: insertedEventId(previous, target),
            chordId: resolution.insertedChordId,
            symbol: {
              ...resolution.insertedSymbol,
              ...(resolution.insertedSymbol.rootSpelling
                ? {
                    rootSpelling: {
                      ...resolution.insertedSymbol.rootSpelling,
                    },
                  }
                : {}),
            },
            function: 'dominant' as const,
            durationBeats: resolution.insertedDuration,
            voicingPosition: 'root' as const,
          },
          resizedPrevious: {
            ...copyEvolutionChord(previous),
            durationBeats: resolution.resizedPreviousDuration,
          },
        },
        priority: resolution.priority,
        theorySources: resolution.theorySources,
      }));
  },
};
