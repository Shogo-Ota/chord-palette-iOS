import { PRO_POLICY, type Capability } from '@/lib/entitlements';
import { colors } from '@/theme/tokens';

/**
 * What the paywall claims Palette Pro gets you.
 *
 * Every perk names the capabilities it is selling, and `shippedPerks()` drops any
 * perk whose claims are not all granted by `PRO_POLICY`. That inverts the failure
 * mode: the paywall can only advertise what the app actually hands a subscriber,
 * so shipping a feature means flipping it on in the policy — and the copy follows.
 *
 * The alternative, a hand-kept `shipped` boolean, is the mistake this replaces:
 * build 5 went to review promising extra presets over an empty catalog, and no
 * amount of comment discipline caught it (App Store Guideline 2.3.1).
 */
export interface Perk {
  glyph: string;
  color: string;
  bg: string;
  border: string;
  title: string;
  desc: string;
  /** Every capability this perk claims. All must be granted for it to be shown. */
  claims: readonly Capability[];
}

const ALL_PERKS: readonly Perk[] = [
  {
    glyph: '♪',
    color: colors.blueText,
    bg: 'rgba(91,140,255,0.14)',
    border: 'rgba(91,140,255,0.32)',
    title: '高度コード',
    desc: '9th / 11th / 13th / オルタード / 借用和音 / セカンダリードミナント / オンコード',
    claims: [
      'chord.extended',
      'chord.altered',
      'chord.secondaryDominant',
      'chord.borrowed',
      'chord.slash',
    ],
  },
  {
    glyph: '★',
    color: colors.purpleText,
    bg: 'rgba(124,92,255,0.15)',
    border: 'rgba(124,92,255,0.35)',
    title: '追加プリセット',
    desc: 'セカンダリードミナントや借用和音を使った進行プリセット',
    claims: ['preset.pro'],
  },
  {
    glyph: '♬',
    color: colors.pinkText,
    bg: 'rgba(214,64,159,0.14)',
    border: 'rgba(214,64,159,0.32)',
    title: '演奏の質',
    desc: '打ち込みらしさを抑えた、手で弾いたようなタイミングとストローク',
    claims: ['performance.humanizePlus'],
  },

  /* ---- Written, not yet granted. These stay invisible until the policy says so. */
  {
    glyph: '◈',
    color: colors.goldText,
    bg: 'rgba(200,162,74,0.14)',
    border: 'rgba(200,162,74,0.32)',
    title: '書き出し',
    desc: '透かしなしの高画質動画',
    claims: ['export.noWatermark'],
  },
  {
    glyph: '⇩',
    color: colors.successText,
    bg: 'rgba(34,197,94,0.13)',
    border: 'rgba(34,197,94,0.30)',
    title: 'MIDI 書き出し',
    desc: '作った進行を DAW へ持ち出す',
    claims: ['midi.export'],
  },
  {
    glyph: '◇',
    color: colors.blueText,
    bg: 'rgba(91,140,255,0.14)',
    border: 'rgba(91,140,255,0.32)',
    title: '高度な理論',
    desc: '裏コード / パッシングディミニッシュ / 代理コード候補',
    claims: ['theory.substitution'],
  },
];

/** The perks Palette Pro can actually deliver today. */
export function shippedPerks(): Perk[] {
  return ALL_PERKS.filter((p) => p.claims.every((c) => PRO_POLICY.allows[c]));
}
