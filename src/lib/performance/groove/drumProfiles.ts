/**
 * Domain-side mirror of the native drum grooves (design §3-1 / requirements §5.6).
 *
 * The sounding drums are authored in Swift (`modules/chord-audio/ios/DrumProvider.swift`)
 * and the Performance Engine's own kick/snare/hat tracks are dropped in the audio mapper
 * (native is authoritative). To make the piano/bass comp *lock to the groove* we still
 * need an accurate, pure model of WHERE each groove's kick and backbeat land — that model
 * is this table. It is the single source of truth on the JS side for groove alignment.
 *
 * IMPORTANT: keep these beat lists in sync with `DrumProvider.pattern(for:)`. The unit
 * test in `__tests__/drumProfiles.test.ts` pins the values so a drift is caught. Pure data
 * — no React Native / Expo / native imports.
 */

/** Which base comp skeleton a groove pairs with (was the ad-hoc GROOVE_FAMILY map). */
export type GrooveFamily = 'eight' | 'sixteen' | 'swing';

/** Rhythmic anatomy of one groove within a 4/4 bar (beats are 0-based, 0..4). */
export interface DrumProfile {
  readonly grooveId: string;
  /** Base skeleton family a Feel picks for this groove. */
  readonly family: GrooveFamily;
  /** Kick onset beats (the low-end push the bass should agree with). */
  readonly kickBeats: readonly number[];
  /** Strong backbeat/snare onset beats (the chord accent should agree with). */
  readonly snareBeats: readonly number[];
  /** Very soft ghost-snare beats, if any (informational; not used for accenting). */
  readonly ghostBeats?: readonly number[];
  /** True for a triplet ride/swing feel (jazz) — comp lays back slightly. */
  readonly swing: boolean;
}

/**
 * The 6 MVP grooves, mirrored 1:1 from `DrumKit.hits(for:)`.
 *  - bossaNova has no backbeat snare (cross-stick clave instead) → snareBeats [] and the
 *    lock falls back to the universal 2 & 4 anchor (see {@link backbeatBeats}).
 */
const PROFILES: Record<string, DrumProfile> = {
  pop8: { grooveId: 'pop8', family: 'eight', kickBeats: [0, 2], snareBeats: [1, 3], swing: false },
  pop16: { grooveId: 'pop16', family: 'sixteen', kickBeats: [0, 2, 2.5], snareBeats: [1, 3], swing: false },
  rock8: { grooveId: 'rock8', family: 'eight', kickBeats: [0, 2], snareBeats: [1, 3], swing: false },
  rock16: { grooveId: 'rock16', family: 'sixteen', kickBeats: [0, 1.5, 2], snareBeats: [1, 3], swing: false },
  soul16: {
    grooveId: 'soul16',
    family: 'sixteen',
    kickBeats: [0, 2.5],
    snareBeats: [1, 3],
    ghostBeats: [1.75, 3.75],
    swing: false,
  },
  // Clap: straight kick on 1 & 3 with a backbeat, plus a hand-clap accent on the
  // 3rd beat (beat index 2). Only kick/snare anchors drive the comp lock; the clap
  // is decorative and modelled natively (DrumKit.hits "clap").
  clap: { grooveId: 'clap', family: 'eight', kickBeats: [0, 2], snareBeats: [1, 3], swing: false },
  bossaNova: { grooveId: 'bossaNova', family: 'swing', kickBeats: [0, 1.5, 2, 3.5], snareBeats: [], swing: false },
};

/** Unknown id → safe default (Pop 8beat), matching the native fallback. */
const DEFAULT_PROFILE = PROFILES.pop8;

/** Resolve a groove id to its drum profile (never throws; unknown ⇒ pop8). */
export function profileFor(grooveId: string): DrumProfile {
  return PROFILES[grooveId] ?? DEFAULT_PROFILE;
}

/** The base skeleton family a groove pairs with (replaces the local GROOVE_FAMILY map). */
export function familyOf(grooveId: string): GrooveFamily {
  return profileFor(grooveId).family;
}

/**
 * The beats the chord comp should agree with as the backbeat anchor: the groove's own
 * strong snare beats when it has them, else the universal 2 & 4 (grooves without a
 * backbeat snare, e.g. bossaNova, still feel their 2 & 4).
 */
export function backbeatBeats(profile: DrumProfile): readonly number[] {
  return profile.snareBeats.length > 0 ? profile.snareBeats : [1, 3];
}
