import type { VisualHarmonicRole } from '@/lib/videoExport/visualHarmonicRole';
import { colors, type ChordFunction } from '@/theme/tokens';

/**
 * The four colours the video paints one chord with.
 *
 * All four share a hue on purpose. A magenta chord under a green glow reads as two
 * unrelated things happening at once, so light is always the chord's own colour getting
 * brighter — never a second colour layered on top.
 */
export interface HarmonicVisualToken {
  /** The glyph fill. This is the colour the viewer reads the chord as. */
  main: string;
  /** The rim around the letters. Brighter than the fill, so it reads as light. */
  outline: string;
  /** Tight glow hugging the glyphs. The brightest value in the set. */
  glowCore: string;
  /** Wide, low-opacity bloom. Same hue, spread out; alpha is applied at draw time. */
  glowOuter: string;
  /** Falling note blocks and key highlights. Same family, deliberately calmer. */
  note: string;
}

/**
 * Neon by contrast rather than by maxed-out channels: a bright, high-chroma core against
 * a near-black navy, with the spread kept dim. Pushing every channel to `ff` would make
 * white-ish letters that lose their hue at thumbnail size, which is the opposite of the
 * goal.
 *
 * Five families have to be separable at a glance for the system to mean anything: cool
 * for rest, green for motion, warm for pull, violet for colour, amber for passing
 * through. Within the warm group the three tension roles step from red toward magenta,
 * which keeps them related — they are all a pull — while staying tellable apart.
 */
export const HARMONIC_VISUAL_TOKENS: Readonly<Record<VisualHarmonicRole, HarmonicVisualToken>> = {
  // Rest. Cool and open, the one family that does not ask for anything.
  stable: {
    main: '#38bdf8',
    outline: '#7dd3fc',
    glowCore: '#a5e8ff',
    glowOuter: '#38bdf8',
    note: '#22a7e0',
  },
  // Going somewhere, without urgency.
  motion: {
    main: '#34d399',
    outline: '#6ee7b7',
    glowCore: '#a7f3d0',
    glowOuter: '#34d399',
    note: '#1fb98a',
  },
  // The dominant pull, and the substitutes that stand in for it.
  tension: {
    main: '#ff3b5c',
    outline: '#ff7a90',
    glowCore: '#ffb3c0',
    glowOuter: '#ff3b5c',
    note: '#e02a49',
  },
  // A dominant aimed at something other than the tonic: the same pull, one step aside.
  secondaryTension: {
    main: '#ff5e8a',
    outline: '#ff93b0',
    glowCore: '#ffc2d4',
    glowOuter: '#ff5e8a',
    note: '#e64a74',
  },
  // The hardest pull: a chromatic approach resolving by semitone. The brightest family.
  leadingTension: {
    main: '#f038e8',
    outline: '#ff7bf3',
    glowCore: '#ffb5f8',
    glowOuter: '#f038e8',
    note: '#d227ca',
  },
  // Colour for its own sake, with no destination demanded.
  color: {
    main: '#a855f7',
    outline: '#c99bff',
    glowCore: '#e0c4ff',
    glowOuter: '#a855f7',
    note: '#9040e0',
  },
  // Passing through. Warm and forward-leaning rather than tense.
  transition: {
    main: '#fbbf24',
    outline: '#fcd34d',
    glowCore: '#fde996',
    glowOuter: '#fbbf24',
    note: '#e0a416',
  },
  // Nothing is known about this chord's role.
  neutral: {
    main: '#94a3b8',
    outline: '#c2cdda',
    glowCore: '#dde4ec',
    glowOuter: '#94a3b8',
    note: '#7d8b9e',
  },
};

export function harmonicVisualToken(role: VisualHarmonicRole): HarmonicVisualToken {
  return HARMONIC_VISUAL_TOKENS[role];
}

/**
 * Borrowed chords keep the colour of the function they perform.
 *
 * Every other advanced technique replaces the function colour, because the technique is
 * what the chord is doing: a secondary dominant is a pull first and a chord second. Modal
 * interchange is not like that. Borrowing says where a chord came from, and `Fm` in C still
 * does a subdominant's job, so recolouring it would hide the one thing the colour is for.
 *
 * So the fill stays the harmonic-function colour and the outline and glow carry the
 * borrowing on their own. `F` and `Fm` come out the same hue; the lit edge is the whole
 * difference, which is exactly the claim being made — same job, borrowed from elsewhere.
 */
export const BORROWED_VISUAL_TOKENS: Readonly<Record<ChordFunction, HarmonicVisualToken>> = {
  tonic: {
    main: colors.tonic,
    outline: '#5ee88a',
    glowCore: '#a7f3c0',
    glowOuter: colors.tonic,
    note: '#1da84f',
  },
  subdominant: {
    main: colors.subdominant,
    outline: '#f5cf4a',
    glowCore: '#fae79a',
    glowOuter: colors.subdominant,
    note: '#c99a07',
  },
  dominant: {
    main: colors.dominant,
    outline: '#f88585',
    glowCore: '#fcbdbd',
    glowOuter: colors.dominant,
    note: '#d13a3a',
  },
};

export function borrowedVisualToken(harmonicFunction: ChordFunction): HarmonicVisualToken {
  return BORROWED_VISUAL_TOKENS[harmonicFunction];
}
