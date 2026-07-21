/**
 * Monetization tier → performance strength (pure, UI/RN/Expo/native-independent).
 *
 * Product philosophy (Slack 2026-07-21): users don't pay for a *feature* (e.g. "I want
 * Add9"); they pay because one tap makes it "oh, that sounds pro". The clearest lever
 * for that is HUMANIZE — the timing feel and the hand-roll (strum) that separate a
 * machine stab from a played chord. So the paid tier is expressed as a small set of
 * strength multipliers on the existing engine, NOT as new logic branches.
 *
 * CRITICAL — no regression: the `free` tier is the IDENTITY (all multipliers = 1), so a
 * free render is byte-identical to the pre-tier output. Only `pro` boosts. Keeping the
 * mapping here (data, one place) avoids a god-switch and lets the future ProfileResolver
 * (blueprint S4) consume the same `Tier` without touching the engine.
 */

/** Paid tier. `free` = the joy of building progressions; `pro` = a step up in polish. */
export type Tier = 'free' | 'pro';

/** Strength multipliers fed to the Performance Engine for a given tier. */
export interface TierProfile {
  /**
   * Micro-humanization window multiplier (on top of tempo × feel scale). Wider = more
   * human timing feel. `free` = 1 (unchanged); `pro` breathes a little more.
   */
  humanizeBoost: number;
  /**
   * Block-chord roll (strum) spread multiplier. `free` = 1 (the bank's subtle roll);
   * `pro` rolls a touch wider so chords read as clearly hand-played.
   */
  strumScale: number;
}

/** `free` is the exact identity — see the file header (no-regression guarantee). */
const FREE: TierProfile = { humanizeBoost: 1, strumScale: 1 };

/**
 * `pro` boosts are deliberately modest: enough to be audibly "more played", never so
 * much that timing gets sloppy. Tuned as data (not logic) so they are easy to revise.
 */
const PRO: TierProfile = { humanizeBoost: 1.15, strumScale: 1.3 };

/** Map a tier to its engine strength multipliers. Pure and total. */
export function tierProfile(tier: Tier): TierProfile {
  return tier === 'pro' ? PRO : FREE;
}
