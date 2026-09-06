import type {
  EvolutionRule,
  EvolutionRuleApplication,
  TechniqueSupportResult,
} from '../../contracts';
import type { EvolutionChord } from '../../types';
import { copyEvolutionChord } from '../chordCopies';

export const SECONDARY_DOMINANT_RULE_ID = 'l3-secondary-dominant';

const MODE_SUPPORT = {
  major: 'SUPPORTED',
  minor: 'UNSUPPORTED',
} as const;

function insertedEventId(previous: EvolutionChord, target: EvolutionChord): string {
  return `evolution:l3:secondary:${previous.eventId}:${target.eventId}`;
}

export const secondaryDominantRule: EvolutionRule = {
  id: SECONDARY_DOMINANT_RULE_ID,
  technique: 'secondary_dominant',
  level: 'reharm',
  modeSupport: MODE_SUPPORT,

  support(context, targetIndex, dependencies): TechniqueSupportResult {
    const resolutions =
      dependencies.secondaryDominant?.resolveSecondaryDominants(context, targetIndex) ?? [];
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
    if (!previous || !target || !dependencies.secondaryDominant) return [];

    return dependencies.secondaryDominant
      .resolveSecondaryDominants(context, targetIndex)
      .map((resolution) => {
        const resizedPrevious: EvolutionChord = {
          ...copyEvolutionChord(previous),
          durationBeats: resolution.resizedPreviousDuration,
        };
        const inserted: EvolutionChord = {
          eventId: insertedEventId(previous, target),
          chordId: resolution.insertedChordId,
          symbol: { ...resolution.insertedSymbol },
          function: 'dominant',
          durationBeats: resolution.insertedDuration,
          voicingPosition: 'root',
        };
        return {
          change: {
            kind: 'insert_before' as const,
            index: targetIndex,
            inserted,
            resizedPrevious,
          },
          priority: resolution.priority,
          theorySources: resolution.theorySources,
        };
      });
  },
};
