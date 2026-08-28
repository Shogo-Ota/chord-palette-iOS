/**
 * The aggregate view of the theory database.
 *
 * Importing this file has no effect on anything the app plays. It is pure data and pure
 * functions, with no dependency on React Native, Expo, or any Chord Palette runtime
 * module — deliberately, so the domain can be reasoned about and tested on its own.
 *
 * Consumers that need one table should import that table's module directly. This object
 * exists for the cases that genuinely need the whole thing: audits, correspondence tests,
 * and documentation.
 */

import { CHORD_PALETTE_HARMONY_POLICY } from './appPolicy';
import { CHORD_FORMULAS } from './chordFormulas';
import { MAJOR_DIATONIC, NATURAL_MINOR_DIATONIC } from './diatonic';
import { DIMINISHED_RULES } from './diminished';
import {
  DOMINANT_SCALE_OPTIONS,
  RELATED_II_RULE,
  SECONDARY_DOMINANTS_MAJOR,
  SUBSTITUTE_DOMINANT,
} from './dominants';
import { FUNCTIONAL_MOTIONS, MAJOR_FUNCTION_GROUPS, MAJOR_MINOR_MIXTURE } from './functions';
import { PROGRESSION_VOCABULARY } from './progressions';
import { SOURCE_TITLE, THEORY_DB_VERSION } from './provenance';
import { SCALE_FORMULAS } from './scales';
import { ADD_RULES, SLASH_CHORD_RULES, SUS_RULES } from './slashChords';
import {
  AVOID_NOTE_HEURISTIC,
  DOMINANT_TENSION_UNIVERSE,
  MAJOR_DIATONIC_TENSIONS,
  NATURAL_MINOR_TENSIONS,
} from './tensions';
import { VOICING_THEORY } from './voicingRules';

export const CHORD_PALETTE_THEORY_DB = {
  version: THEORY_DB_VERSION,
  sourceTitle: SOURCE_TITLE,
  chordFormulas: CHORD_FORMULAS,
  scales: SCALE_FORMULAS,
  majorDiatonic: MAJOR_DIATONIC,
  naturalMinorDiatonic: NATURAL_MINOR_DIATONIC,
  majorTensions: MAJOR_DIATONIC_TENSIONS,
  naturalMinorTensions: NATURAL_MINOR_TENSIONS,
  dominantTensions: DOMINANT_TENSION_UNIVERSE,
  dominantScaleOptions: DOMINANT_SCALE_OPTIONS,
  avoidNoteHeuristic: AVOID_NOTE_HEURISTIC,
  functionalMotions: FUNCTIONAL_MOTIONS,
  majorFunctionGroups: MAJOR_FUNCTION_GROUPS,
  borrowedChords: MAJOR_MINOR_MIXTURE,
  secondaryDominants: SECONDARY_DOMINANTS_MAJOR,
  substituteDominant: SUBSTITUTE_DOMINANT,
  relatedIi: RELATED_II_RULE,
  slashChords: SLASH_CHORD_RULES,
  susRules: SUS_RULES,
  addRules: ADD_RULES,
  diminished: DIMINISHED_RULES,
  progressionVocabulary: PROGRESSION_VOCABULARY,
  voicingTheory: VOICING_THEORY,
  appPolicy: CHORD_PALETTE_HARMONY_POLICY,
} as const;

export type TheoryDatabase = typeof CHORD_PALETTE_THEORY_DB;
