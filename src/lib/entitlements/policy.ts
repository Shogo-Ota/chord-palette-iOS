import { UNLIMITED, type Capability, type LimitKey } from './capabilities';

/**
 * What one tier is allowed to do. Two constants below hold the entire free/paid
 * boundary, so the answer to "what does paying actually get me?" is readable in
 * one place instead of reconstructed from gates scattered across screens.
 */
export interface TierPolicy {
  readonly id: 'free' | 'pro';
  readonly allows: Readonly<Record<Capability, boolean>>;
  readonly limits: Readonly<Record<LimitKey, number>>;
}

/**
 * The free tier.
 *
 * The product rule these values encode: free is not a crippled paid tier, it is a
 * complete one. Everything needed to write a progression and share it — all 13
 * rhythms, all drum grooves, diatonic triads and sevenths, add9/sus4, chord
 * function display, 16 bars, video export — stays here. What sits behind the
 * paywall is *extra harmonic reach*, not permission to use the app.
 */
export const FREE_POLICY: TierPolicy = {
  id: 'free',
  allows: {
    'chord.extended': false,
    'chord.altered': false,
    'chord.secondaryDominant': false,
    'chord.borrowed': false,
    'chord.slash': false,
    'chord.sus2': false,
    'key.transpose': false,
    'preset.pro': false,
    'suggestion.pro': false,
    'theory.substitution': false,
    'performance.humanizePlus': false,
    'export.noWatermark': false,
    'midi.export': false,
  },
  limits: {
    // Today every tier saves without limit and exports at 1080. Tightening these
    // is a separate, grandfathered change — existing work must not become
    // unreachable because a cap appeared underneath it.
    projects: UNLIMITED,
    favourites: UNLIMITED,
    videoHeight: 1920,
  },
};

/** Palette Pro. Everything the free tier has, plus the reach it does not. */
export const PRO_POLICY: TierPolicy = {
  id: 'pro',
  allows: {
    'chord.extended': true,
    'chord.altered': true,
    'chord.secondaryDominant': true,
    'chord.borrowed': true,
    'chord.slash': true,
    'chord.sus2': true,
    'key.transpose': true,
    'preset.pro': true,
    'suggestion.pro': true,
    // Not shipped yet. Left false so nothing can advertise it by reading the
    // policy — see the paywall's `shipped` flag for the other half of this.
    'theory.substitution': false,
    'performance.humanizePlus': true,
    'export.noWatermark': false,
    'midi.export': false,
  },
  limits: {
    projects: UNLIMITED,
    favourites: UNLIMITED,
    videoHeight: 1920,
  },
};
