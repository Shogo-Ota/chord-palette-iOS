/**
 * Chord Palette's own harmony policy. **The book does not assert any of this.**
 *
 * These are implementation decisions the book's theory motivates but does not make. The
 * separation matters practically, not just editorially: the book declines to turn avoid
 * notes, tritones or major sevenths into hard gates, so a claim like "reject every
 * semitone" has to be defended as our product judgement about accompaniment mud, and can
 * be revised on listening evidence without contradicting any theory.
 *
 * Everything here is typed with {@link AppPolicySourceRef}, which has no page field. If a
 * claim in this file ever seems to need a citation, it belongs in a book-derived module
 * instead.
 */

import type { AppPolicySourceRef } from './provenance';

const POLICY_PROVENANCE: AppPolicySourceRef = {
  kind: 'APP_POLICY_PROPOSED',
  chapter: 'Chord Palette implementation layer',
};

export const CHORD_PALETTE_HARMONY_POLICY = {
  provenance: POLICY_PROVENANCE,

  /** Intended evaluation order, outermost identity first, register last. */
  validationOrder: [
    'resolveChordDefinition',
    'resolveChordScaleAndTensions',
    'validatePitchClassMembership',
    'validateSlashBassSeparately',
    'validateRequiredCharacteristicTones',
    'validateAvoidNotes',
    'validateRegisterAndPairwiseCollisions',
    'applyVoiceLeadingScore',
  ] as const,

  chordToneMembership: {
    coreChordTonesAreAlwaysAllowed: true,
    tensionsRequireExplicitContextRule: true,
    /** A symbol names what it names; the engine may not enrich it. */
    doNotAutoAddExtensionsFromChordSymbol: true,
  },

  voicing: {
    perfectFifthOmissionDefault: true,
    alteredFifthOmissionDefault: false,
    preserveGuideTonesInSeventhChords: true,
    allowRootlessUpperVoicingOnlyWhenBassRoleSuppliesRoot: true,
  },

  collisionSafety: {
    /**
     * Measured in real MIDI distance, never in pitch-class interval. 1 and 13 semitones
     * are different verdicts, and interval class 1 cannot tell them apart.
     */
    rejectDirectMinorSecondSemitones: 1,
    rejectDirectMinorNinthSemitones: 13,
    doNotBanTritoneWhenChordDefinitionRequiresIt: true,
    doNotBanMajorSeventhWhenChordDefinitionRequiresIt: true,
  },

  lowRegister: {
    belowMidi48RejectIntervalsSmallerThanSemitones: 7,
    belowMidi36RejectIntervalsSmallerThanSemitones: 12,
  },
} as const;
