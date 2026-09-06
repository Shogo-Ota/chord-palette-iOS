import type { SourceRef } from '@/lib/musicTheory';
import type {
  ChordDuration,
  ChordFunction,
  ChordRootSpelling,
  KeyMode,
  MajorKey,
  VoicingPosition,
} from '@/types';

export type EvolutionLevel = 'original' | 'seventh' | 'tension' | 'reharm';

export type ReharmTechnique =
  | 'add_seventh'
  | 'add_tension'
  | 'slash_chord'
  | 'secondary_dominant'
  | 'passing_diminished'
  | 'borrowed_chord'
  | 'tritone_substitute';

export type TechniqueSupport = 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED';

export type EvolutionEvidence =
  'DESIGN_TARGET' | 'MEASURED' | 'MEASURED_AGGREGATE' | 'USER_LISTENING' | 'HYPOTHESIS' | 'UNKNOWN';

export type EvolutionGenerationMethod = 'RULE_BASED';

export type EvolutionScope =
  { readonly kind: 'chord'; readonly index: number } | { readonly kind: 'progression' };

/**
 * A local key is used only when a caller deliberately marks it as explicit.
 * Chord roots outside the session key never imply modulation by themselves.
 */
export type ExplicitLocalHarmonicContext = {
  readonly kind: 'EXPLICIT_LOCAL';
  readonly tonic: MajorKey;
  readonly mode: KeyMode;
};

export type EvolutionChordSymbol = {
  readonly rootOffset: number;
  readonly suffix: string;
  readonly definitionId?: string;
  readonly rootSpelling?: ChordRootSpelling;
  readonly bassOffset?: number;
};

/**
 * Harmony-domain projection of a placed chord.
 *
 * Display strings, React state and persistence details intentionally stay outside
 * this contract. `eventId` preserves placement identity for a later atomic apply.
 */
export type EvolutionChord = {
  readonly eventId: string;
  readonly chordId: string;
  readonly symbol: EvolutionChordSymbol;
  readonly function: ChordFunction;
  readonly durationBeats: ChordDuration;
  readonly localHarmonicContext?: ExplicitLocalHarmonicContext;
  readonly voicingPosition?: VoicingPosition;
};

export type EvolutionContext = {
  /** Existing `MajorKey` is the app's tonic spelling type despite its legacy name. */
  readonly tonic: MajorKey;
  readonly mode: KeyMode;
  readonly progression: readonly EvolutionChord[];
  readonly scope: EvolutionScope;
  readonly level: EvolutionLevel;
};

export type EvolutionChange =
  | {
      readonly kind: 'replace';
      readonly index: number;
      readonly before: EvolutionChord;
      readonly after: EvolutionChord;
    }
  | {
      readonly kind: 'insert_before';
      readonly index: number;
      readonly inserted: EvolutionChord;
      readonly resizedPrevious: EvolutionChord;
    };

export type EvolutionScoreComponent = {
  readonly id: string;
  readonly value: number;
};

/**
 * Phase 1 candidates are deliberately unevaluated. A numeric score becomes legal
 * only when Phase 4 has actually run the approved scoring policy.
 */
export type EvolutionScore =
  | { readonly status: 'UNEVALUATED' }
  | {
      readonly status: 'SCORED';
      readonly total: number;
      readonly components: readonly EvolutionScoreComponent[];
    };

export type EvolutionTheoryLabel =
  | 'DIATONIC_SEVENTH'
  | 'AVAILABLE_TENSION'
  | 'CHORD_TONE_INVERSION'
  | 'SECONDARY_DOMINANT'
  | 'PASSING_DIMINISHED'
  | 'TRITONE_SUBSTITUTE';
export type EvolutionRationaleCode =
  | 'DIATONIC_TRIAD_TO_SEVENTH'
  | 'DIATONIC_SEVENTH_TO_AVAILABLE_TENSION'
  | 'CHORD_TONE_BASS_SMOOTHING'
  | 'SECONDARY_DOMINANT_RESOLUTION'
  | 'CHROMATIC_PASSING_DIMINISHED'
  | 'TRITONE_DOMINANT_SUBSTITUTION';

export interface EvolutionCandidate {
  readonly id: string;
  readonly level: EvolutionLevel;
  readonly technique: ReharmTechnique;
  readonly scope: EvolutionScope;
  readonly before: readonly EvolutionChord[];
  readonly after: readonly EvolutionChord[];
  readonly changes: readonly EvolutionChange[];
  readonly requiredTier: 'FREE' | 'PRO';
  readonly theoryLabel: EvolutionTheoryLabel;
  readonly rationaleCode: EvolutionRationaleCode;
  readonly score: EvolutionScore;
  readonly generationMethod: EvolutionGenerationMethod;
  readonly evidence: EvolutionEvidence;
  /** Book/app-policy provenance is separate from evidence level. */
  readonly theorySources: readonly SourceRef[];
}
