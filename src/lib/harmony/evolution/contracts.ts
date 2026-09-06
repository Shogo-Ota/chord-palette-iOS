import type { DegreeToken, SourceRef, TensionToken } from '@/lib/musicTheory';
import type { KeyMode } from '@/types';

import type {
  EvolutionCandidate,
  EvolutionChange,
  EvolutionChord,
  EvolutionChordSymbol,
  EvolutionContext,
  EvolutionLevel,
  ReharmTechnique,
  TechniqueSupport,
} from './types';

export type TechniqueSupportReason =
  'ELIGIBLE' | 'CHORD_NOT_ELIGIBLE' | 'MODE_UNSUPPORTED' | 'TARGET_OUT_OF_RANGE';

export type TechniqueSupportResult = {
  readonly status: TechniqueSupport;
  readonly eligible: boolean;
  readonly reason: TechniqueSupportReason;
};

export type DiatonicSeventhResolution = {
  readonly degreeIndex: number;
  readonly targetChordId: string;
  readonly targetSymbol: EvolutionChordSymbol & { readonly definitionId: string };
  readonly theorySources: readonly SourceRef[];
};

export type AvailableTensionResolution = {
  readonly targetChordId: string;
  readonly targetSymbol: EvolutionChordSymbol & { readonly definitionId: string };
  readonly addedTensions: readonly TensionToken[];
  /** Deterministic rule order; not a measured musical score. */
  readonly priority: number;
  readonly theorySources: readonly SourceRef[];
};

export type SlashBassResolution = {
  readonly targetChordId: string;
  readonly bassOffset: number;
  readonly bassDegree: DegreeToken;
  readonly totalMovement: number;
  readonly maximumLeap: number;
  readonly improvement: number;
  /** Deterministic rule order; not a measured musical score. */
  readonly priority: number;
  readonly theorySources: readonly SourceRef[];
};

/** Port owned by Harmony Domain; the production provider reads existing theory data. */
export interface EvolutionTheoryProvider {
  resolveDiatonicSeventh(
    context: Pick<EvolutionContext, 'tonic' | 'mode'>,
    chord: EvolutionChord,
  ): DiatonicSeventhResolution | null;
}

export interface EvolutionTensionProvider {
  resolveAvailableTensions(
    context: Pick<EvolutionContext, 'tonic' | 'mode'>,
    chord: EvolutionChord,
  ): readonly AvailableTensionResolution[];
}

export interface EvolutionSlashProvider {
  resolveChordToneBassOptions(
    context: EvolutionContext,
    targetIndex: number,
  ): readonly SlashBassResolution[];
}

export type EvolutionRuleDependencies = {
  readonly theory: EvolutionTheoryProvider;
  /** Optional so direct Phase 1 rule tests and custom callers remain compatible. */
  readonly tension?: EvolutionTensionProvider;
  /** Optional so direct Phase 1 rule tests and custom callers remain compatible. */
  readonly slash?: EvolutionSlashProvider;
};

export type EvolutionRuleApplication = {
  readonly change: EvolutionChange;
  /** Deterministic rule order; absent means the rule has one result. */
  readonly priority?: number;
  readonly theorySources: readonly SourceRef[];
};

export interface EvolutionRule {
  readonly id: string;
  readonly technique: ReharmTechnique;
  readonly level: EvolutionLevel;
  readonly modeSupport: Readonly<Record<KeyMode, TechniqueSupport>>;

  support(
    context: EvolutionContext,
    targetIndex: number,
    dependencies: EvolutionRuleDependencies,
  ): TechniqueSupportResult;

  generate(
    context: EvolutionContext,
    targetIndex: number,
    dependencies: EvolutionRuleDependencies,
  ): readonly EvolutionRuleApplication[];
}

export interface EvolutionRuleRegistry {
  get(ruleId: string): EvolutionRule | undefined;
}

export interface EvolutionRecipe {
  readonly id: string;
  readonly level: EvolutionLevel;
  readonly ruleIds: readonly string[];
  readonly requiredTier: 'FREE' | 'PRO';

  build(
    context: EvolutionContext,
    registry: EvolutionRuleRegistry,
    dependencies: EvolutionRuleDependencies,
  ): readonly EvolutionCandidate[];
}
