import type { VisualAccentFamily } from '@/lib/videoExport/visualAccentFamily';

/**
 * The colours of the *light* around one chord. Never its fill.
 *
 * The glyph body stays on the legacy harmonic-function colour — tonic green, subdominant
 * amber, dominant red — because that is the one thing a viewer reads first and it has to keep
 * meaning the same thing across every chord. So `F` and `Fm` are the same amber, and only the
 * light around `Fm` says it was borrowed. Overriding the fill would have traded a fact the
 * viewer already knows how to read for one they do not.
 *
 * The three values share a hue with each other, not with the fill. Light of a different hue
 * from the body is the entire signal here, so the set is tuned to stay legible over any of the
 * three function colours rather than to blend into one.
 */
export interface HarmonicVisualToken {
  /** Small marks that identify the chord as advanced — the rail dot, and nothing large. */
  accent: string;
  /** The rim around the letters. */
  outline: string;
  /** Tight glow hugging the glyphs. The brightest value in the set. */
  glowCore: string;
  /** Wide, low-opacity bloom. Same hue, spread out; alpha is applied at draw time. */
  glowOuter: string;
}

/**
 * Neon by contrast rather than by maxed-out channels: a bright, high-chroma core against
 * a near-black navy, with the spread kept dim. Pushing every channel to `ff` would make
 * white-ish halos that lose their hue at thumbnail size, which is the opposite of the
 * goal.
 *
 * Four families have to be separable at a glance for the system to mean anything: warm for a
 * pull, cyan for an alternate route to the same place, violet for colour borrowed from elsewhere,
 * amber for passing through. Within the warm group the tension roles step from red toward
 * magenta, which keeps them related — they are all a pull — while staying tellable apart.
 */
export const HARMONIC_VISUAL_TOKENS: Readonly<Record<VisualAccentFamily, HarmonicVisualToken>> = {
  // A pull whose light is free to be red, because its body is not.
  tension: {
    accent: '#ff3b5c',
    outline: '#ff7a90',
    glowCore: '#ffb3c0',
    glowOuter: '#ff3b5c',
  },
  /**
   * The substituted route to the tonic.
   *
   * Cyan because the body is already dominant red: red is the property of the function, and a
   * second red on top of it would say nothing the fill had not said. Against the near-black navy
   * these read as electric rather than pastel, which is what keeps them from looking like a
   * highlight.
   */
  substitute: {
    accent: '#22d3ee',
    outline: '#67e8f9',
    glowCore: '#a5f3fc',
    glowOuter: '#22d3ee',
  },
  // A dominant aimed at something other than the tonic: the same pull, one step aside.
  secondaryTension: {
    accent: '#ff5e8a',
    outline: '#ff93b0',
    glowCore: '#ffc2d4',
    glowOuter: '#ff5e8a',
  },
  // The hardest pull: a chromatic approach resolving by semitone. The brightest family.
  leadingTension: {
    accent: '#f038e8',
    outline: '#ff7bf3',
    glowCore: '#ffb5f8',
    glowOuter: '#f038e8',
  },
  // Colour from outside the key, with no destination demanded.
  color: {
    accent: '#a855f7',
    outline: '#c99bff',
    glowCore: '#e0c4ff',
    glowOuter: '#a855f7',
  },
  // Passing through. Warm and forward-leaning rather than tense.
  transition: {
    accent: '#fbbf24',
    outline: '#fcd34d',
    glowCore: '#fde996',
    glowOuter: '#fbbf24',
  },
  // Nothing is known about this chord's role, so the caller draws no light at all.
  neutral: {
    accent: '#94a3b8',
    outline: '#c2cdda',
    glowCore: '#dde4ec',
    glowOuter: '#94a3b8',
  },
};

export function harmonicVisualToken(family: VisualAccentFamily): HarmonicVisualToken {
  return HARMONIC_VISUAL_TOKENS[family];
}
