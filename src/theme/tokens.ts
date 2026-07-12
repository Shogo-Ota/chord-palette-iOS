/**
 * Chord Palette — Design Tokens
 *
 * Extracted 1:1 from the Claude Design mockup (`Chord Palette.dc.html`).
 * The mock's inner screen is 390×842, which matches the iPhone 12/13/14 logical
 * resolution (390×844 pt), so px values from the mock map directly to RN points.
 *
 * Theme: dark. Base = deep navy / charcoal / black. Primary accent = purple→blue.
 * Rainbow accents used sparingly for chord function / selection / Pro.
 */

export const colors = {
  // App / screen backgrounds
  appBg: '#070a12',
  screenBg: '#0d1422',
  screenGradientTop: '#16203a',
  screenGradientMid: '#0b1020',

  // Surfaces
  surface: '#141c2b', // primary card
  surfaceRaised: '#151d2c', // header pills / icon buttons
  surfacePanel: '#101828', // playback / volume panels
  surfacePanelAlt: '#131a2a', // paywall perk rows
  surfaceInput: '#0f1626', // inner selects / segmented track
  surfaceChip: '#1e293c', // meta chips on project cards
  surfaceIconBtn: '#1b2436', // round transport buttons
  surfaceLocked: '#10151f', // locked (Pro) tiles
  surfaceCard2: '#0f1424', // price card inner

  // Borders
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.10)',
  borderSoft: 'rgba(255,255,255,0.08)',
  borderSubtle: 'rgba(255,255,255,0.06)',
  borderFaint: 'rgba(255,255,255,0.05)',

  // Text
  textBright: '#f4f6fb',
  textPrimary: '#eef1f6',
  textHeading: '#e6eaf2',
  textSecondary: '#cdd4e2',
  textTertiary: '#b9c2d4',
  textMuted: '#9aa3b5',
  textDim: '#8a94a8',
  textFaint: '#6b7688',
  textFaintest: '#525c70',
  textArrow: '#525c70',

  // Primary (purple→blue)
  primary: '#7c5cff',
  primaryDeep: '#7c4dff',
  primaryBlue: '#5b8cff',
  primaryBlueDeep: '#3b82f6',

  // Accents / states
  purpleText: '#b9a6ff',
  purpleSoft: '#c9bbff',
  blueText: '#8fb6f2',
  pink: '#d6409f',
  pinkText: '#f0a3d0',
  pinkSoft: '#c99ad8',
  gold: '#c8a24a', // Pro lock icon
  goldText: '#e6c34a',

  // Chord function colors
  tonic: '#22c55e',
  subdominant: '#eab308',
  dominant: '#ef4444',
  tonicText: '#7fd99b',
  subdominantText: '#ecc94b',
  dominantText: '#f0918f',

  // Semantic
  success: '#22c55e',
  successText: '#7fd99b',
  danger: '#ef4444',
  dangerText: '#ef6a6a',
  dangerSoft: '#f0918f',

  white: '#ffffff',
  black: '#000000',
} as const;

/** Rainbow palette used for the wordmark, Pro gradients and the export visualizer. */
export const rainbow = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'] as const;
export const rainbowFull = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#d6409f'] as const;

/** Primary CTA / selection gradient (135deg #7c5cff → #5b8cff). */
export const primaryGradient = ['#7c5cff', '#5b8cff'] as const;
/** Slider fill gradient (90deg #5b8cff → #7c4dff). */
export const sliderGradient = ['#5b8cff', '#7c4dff'] as const;

export const spacing = {
  xs: 4,
  sm: 7,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 20,
  xxxl: 26,
} as const;

export const radius = {
  sm: 7,
  md: 9,
  lg: 11,
  xl: 14,
  '2xl': 16,
  '3xl': 18,
  '4xl': 20,
  pill: 999,
} as const;

export const font = {
  // Loaded via @expo-google-fonts/noto-sans-jp in the root layout; falls back to system.
  regular: 'NotoSansJP_400Regular',
  medium: 'NotoSansJP_500Medium',
  semibold: 'NotoSansJP_600SemiBold',
  bold: 'NotoSansJP_700Bold',
  extrabold: 'NotoSansJP_800ExtraBold',
  black: 'NotoSansJP_900Black',
  mono: 'ui-monospace',
} as const;

/** Chord-function → color helper. */
export type ChordFunction = 'tonic' | 'subdominant' | 'dominant';
export const functionColor: Record<ChordFunction, string> = {
  tonic: colors.tonic,
  subdominant: colors.subdominant,
  dominant: colors.dominant,
};
