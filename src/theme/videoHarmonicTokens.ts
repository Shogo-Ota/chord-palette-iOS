import type { VisualHarmonicRole } from '@/lib/videoExport/visualHarmonicRole';

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
