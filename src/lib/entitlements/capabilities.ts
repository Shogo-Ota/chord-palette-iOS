/**
 * The vocabulary of things the app can gate (pure — no RN / Expo / store SDK).
 *
 * A capability is a *yes or no* question ("may this user place a slash chord?").
 * Anything that is a *quantity* ("how many projects may they keep?") belongs in
 * {@link LimitKey} instead, because a boolean cannot express "five".
 *
 * Adding a member here is deliberately a compile error until both FREE_POLICY and
 * PRO_POLICY say what they think of it — see `policy.ts`. That is the point: the
 * free/paid boundary should never drift because someone forgot to decide.
 */
export type Capability =
  /* Chords the library offers but does not hand to everyone. */
  | 'chord.extended'
  | 'chord.altered'
  | 'chord.secondaryDominant'
  | 'chord.borrowed'
  | 'chord.slash'
  | 'chord.sus2'
  /* Writing. */
  | 'key.transpose'
  | 'preset.pro'
  | 'suggestion.pro'
  | 'theory.substitution'
  /* Output. */
  | 'performance.humanizePlus'
  | 'export.noWatermark'
  | 'midi.export';

/**
 * The quantities a tier caps. Values are read through `limitFor`, never inlined
 * at the call site, so raising a cap is a one-line data change with no store
 * review attached.
 */
export type LimitKey =
  /** How many saved projects a tier may keep. */
  | 'projects'
  /** How many favourites a tier may keep. */
  | 'favourites'
  /** Tallest video a tier may export, in pixels (the 9:16 long edge). */
  | 'videoHeight';

/** Use for a cap that is not really a cap, so the comparison stays a comparison. */
export const UNLIMITED = Number.POSITIVE_INFINITY;
