/**
 * Accompaniment sub-variations — one accompaniment, several readings of it.
 *
 * The five accompaniments answer "what kind of backing"; a variant answers "played
 * how". A variant is data, never code: it names the skeleton it wants, the bank it
 * rotates through, and the difference from the base. Adding one is a single entry in
 * `catalog.ts` — the engine, the screen and the persistence layer stay untouched.
 */

import type { StyleRefinement } from '../styles/refine';
import type { StylePreset } from '../styles/types';

/**
 * Globally unique, stable id — `<accompaniment>.<variant>`, e.g. `natural.sparse`.
 * Scoping by accompaniment keeps a saved project unambiguous and makes a log or an
 * analytics event readable on its own.
 */
export type AccompanimentVariantId = string;

export interface AccompanimentVariant {
  id: AccompanimentVariantId;
  /** Short chip caption. */
  label: string;
  /** One line telling the player what changes. */
  hint: string;
  /**
   * Templates the engine rotates through, one 4-bar phrase at a time. A single entry
   * means "always this one"; omitted means the accompaniment's own default (only
   * Natural has one). Every member must share the base's grid, gate and dynamics, so
   * a rotation reads as one player re-phrasing rather than as a change of instrument.
   */
  bank?: readonly StylePreset[];
  /**
   * Pin the skeleton the feel's refinements land on, instead of letting the feel pick
   * one from tempo and drum groove. Only meaningful for the feel-based accompaniments.
   */
  forcedBase?: StylePreset;
  /**
   * The Human MIDI Template this reading plays — a real teacher take from the approved
   * pattern pool. When set it owns the piano chord/top voices (the groove, gate and
   * dynamics come from the take; the pitches are rebuilt from the user's chord), so
   * `bank` and the chord half of `refine` no longer apply.
   */
  humanTemplateId?: string;
  /**
   * When `false`, the reading stays in the catalog so a saved project can still
   * resolve it, but the Style screen and MIDI QA do not offer it. Omitted means
   * offered.
   */
  offered?: boolean;
  /** The difference from the resolved base. */
  refine?: StyleRefinement;
}
