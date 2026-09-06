import type { SourceRef } from '@/lib/musicTheory';
import type { ChordDuration } from '@/types';

import type {
  EvolutionCandidate,
  EvolutionChordSymbol,
  EvolutionContext,
  ReharmTechnique,
} from '../types';

export type L3Technique = Extract<
  ReharmTechnique,
  'secondary_dominant' | 'passing_diminished' | 'tritone_substitute'
>;

export type L3HarmonicEffect =
  | 'COLOR_EXTENSION'
  | 'BASS_SMOOTHING'
  | 'DOMINANT_RESOLUTION'
  | 'CHROMATIC_CONNECTOR'
  | 'DOMINANT_SUBSTITUTION';

export type L3ScoreComponentId =
  | 'resolutionStrength'
  | 'voiceLeadingCost'
  | 'bassMovementCost'
  | 'commonToneScore'
  | 'harmonicFunctionFit'
  | 'tensionValidity'
  | 'complexityDelta';

export type L3InsertionResolution = {
  readonly targetIndex: number;
  readonly insertedChordId: string;
  readonly insertedSymbol: EvolutionChordSymbol & {
    readonly definitionId: string;
  };
  readonly resizedPreviousDuration: ChordDuration;
  readonly insertedDuration: ChordDuration;
  readonly harmonicEffect: L3HarmonicEffect;
  readonly resolutionStrength: number;
  readonly priority: number;
  readonly theorySources: readonly SourceRef[];
};

export type SecondaryDominantResolution = L3InsertionResolution & {
  readonly targetDegree: string;
  readonly targetRootOffset: number;
};

export type PassingDiminishedResolution = L3InsertionResolution & {
  readonly direction: -1 | 1;
  readonly bassMotion: readonly [1, 1];
};

export type TritoneSubstitutionResolution = {
  readonly dominantIndex: number;
  readonly targetIndex: number;
  readonly targetChordId: string;
  readonly targetSymbol: EvolutionChordSymbol & {
    readonly definitionId: string;
  };
  readonly harmonicEffect: 'DOMINANT_SUBSTITUTION';
  readonly resolutionStrength: number;
  readonly priority: number;
  readonly theorySources: readonly SourceRef[];
};

export interface EvolutionSecondaryDominantProvider {
  resolveSecondaryDominants(
    context: EvolutionContext,
    targetIndex: number,
  ): readonly SecondaryDominantResolution[];
}

export interface EvolutionPassingDiminishedProvider {
  resolvePassingDiminished(
    context: EvolutionContext,
    targetIndex: number,
  ): readonly PassingDiminishedResolution[];
}

export interface EvolutionTritoneSubstitutionProvider {
  resolveTritoneSubstitutions(
    context: EvolutionContext,
    dominantIndex: number,
  ): readonly TritoneSubstitutionResolution[];
}

export type L3ProviderDependencies = {
  readonly secondaryDominant?: EvolutionSecondaryDominantProvider;
  readonly passingDiminished?: EvolutionPassingDiminishedProvider;
  readonly tritoneSubstitution?: EvolutionTritoneSubstitutionProvider;
};

export type RankableEvolutionCandidate = {
  readonly candidate: EvolutionCandidate;
  readonly harmonicEffect: L3HarmonicEffect;
};
