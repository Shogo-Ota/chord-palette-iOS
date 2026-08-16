/**
 * The accompaniment variant catalog — pure data.
 *
 * Two rules hold throughout. The FIRST variant of every accompaniment is the reading
 * that shipped before variants existed and carries no refinement, so a project saved
 * without a variant sounds exactly as it did. And a variant only ever bends the
 * skeleton it is given: none of them reaches for a different instrument, tempo or
 * drum groove, because those are the player's other two choices.
 */

import type { AccompanimentPattern } from '@/types';

import { NATURAL_BANK } from '../feel/naturalBank';
import {
  HUMAN_TEMPLATE_ARPEGGIO_P1_A10,
  HUMAN_TEMPLATE_ARPEGGIO_P1_A11,
  HUMAN_TEMPLATE_ARPEGGIO_P1_C10,
  HUMAN_TEMPLATE_ARPEGGIO_P1_C11,
  HUMAN_TEMPLATE_ARPEGGIO_P2_A10,
  HUMAN_TEMPLATE_BALLAD_P1_A7,
  HUMAN_TEMPLATE_BALLAD_P1_A8,
  HUMAN_TEMPLATE_BALLAD_P1_C7,
  HUMAN_TEMPLATE_BALLAD_P1_C8,
  HUMAN_TEMPLATE_BALLAD_P4_A7,
  HUMAN_TEMPLATE_NORMAL_P1_A1,
  HUMAN_TEMPLATE_NORMAL_P1_A3,
  HUMAN_TEMPLATE_NORMAL_P1_C1,
  HUMAN_TEMPLATE_VARIATION_P1_C12,
  HUMAN_TEMPLATE_VARIATION_P1_C13,
  HUMAN_TEMPLATE_VARIATION_P1_C14,
} from '../humanTemplate/catalog';
import { NATURAL_COMP } from '../styles/naturalComp';
import { NATURAL_COMP_DENSE } from '../styles/naturalCompDense';
import { NATURAL_COMP_SPARSE } from '../styles/naturalCompSparse';
import type { StepPattern } from '../styles/types';

import type { AccompanimentVariant } from './types';

/* ------------------------------------------------------------------ */
/* Rhythms a variant substitutes for its base's own                    */
/* ------------------------------------------------------------------ */

const X = true;
const o = false;

/** Halves on an 8-step bar: beats 1 and 3. */
const HALVES: StepPattern = {
  hits: [X, o, o, o, X, o, o, o],
  accent: [1.0, 0.5, 0.5, 0.5, 0.85, 0.5, 0.5, 0.5],
};

/** Eighth notes on a 16-step bar — every other step, beat heads weighted. */
const EIGHTHS_ON_16: StepPattern = {
  hits: [X, o, X, o, X, o, X, o, X, o, X, o, X, o, X, o],
  accent: [0.8, 0.5, 0.55, 0.5, 0.7, 0.5, 0.55, 0.5, 0.75, 0.5, 0.55, 0.5, 0.68, 0.5, 0.55, 0.5],
};

/** Quarter notes on an 8-step bar — the pulse a slow arpeggio walks on. */
const QUARTERS_ON_8: StepPattern = {
  hits: [X, o, X, o, X, o, X, o],
  accent: [0.85, 0.4, 0.6, 0.4, 0.7, 0.4, 0.6, 0.4],
};

/**
 * Ballad slow arpeggio (ballad_engine_spec §3 `ballad.arp.slow`): four 8ths climb
 * through beats 1–2, then one held answer on beat 3 — the rise breathes, the hold
 * rings. Accents taper as the line climbs so the landing chord stays the peak.
 */
const BALLAD_ARP_SLOW: StepPattern = {
  hits: [X, X, X, X, X, o, o, o],
  accent: [0.85, 0.52, 0.6, 0.55, 0.75, 0.4, 0.4, 0.4],
};

/**
 * Sparser 16th comps: keep beat heads, drop half the "a" pushes so rests open the
 * groove (city-pop / R&B breathing room).
 */
const BEAT16_SPARSE_CHORD: StepPattern = {
  hits: [X, o, o, o, X, o, o, X, X, o, o, o, X, o, o, X],
  accent: [1.0, 0.4, 0.4, 0.4, 0.72, 0.4, 0.4, 0.55, 0.88, 0.4, 0.4, 0.4, 0.7, 0.4, 0.4, 0.55],
};

/** Funkier 16ths: emphasize the "e" and "a" offs of each beat. */
const BEAT16_FUNK_CHORD: StepPattern = {
  hits: [X, o, X, X, o, o, X, X, X, o, X, X, o, o, X, X],
  accent: [0.9, 0.4, 0.55, 0.75, 0.4, 0.4, 0.55, 0.78, 0.85, 0.4, 0.55, 0.72, 0.4, 0.4, 0.55, 0.75],
};

/* ------------------------------------------------------------------ */
/* The catalog                                                         */
/* ------------------------------------------------------------------ */

/**
 * Production offers Block Type1, Natural Type1–3 and Variation Type1–3.
 * Block is a single plain held-chord reading — no teacher take.
 * Variation Types are P1_C12 / P1_C13 / P1_C14 (the Style screen label is
 * バリエーション; the rhythm id stays `arpeggio` so saved projects still resolve).
 * Older Natural banks and retired Arpeggio takes stay in the catalog
 * (`offered: false`).
 */
const BLOCK_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'block.type1',
    label: 'ブロック',
    hint: 'コード構成音を、コードの長さいっぱい鳴らす',
  },
];

const ARPEGGIO_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'arpeggio.type1',
    label: 'Type 1',
    hint: 'バリエーション1。動きのある標準の弾き',
    humanTemplateId: HUMAN_TEMPLATE_VARIATION_P1_C12,
  },
  {
    id: 'arpeggio.type2',
    label: 'Type 2',
    hint: 'バリエーション2。別のフレーズ',
    humanTemplateId: HUMAN_TEMPLATE_VARIATION_P1_C13,
  },
  {
    id: 'arpeggio.type3',
    label: 'Type 3',
    hint: 'バリエーション3。もう少し形の違う弾き',
    humanTemplateId: HUMAN_TEMPLATE_VARIATION_P1_C14,
  },
  {
    id: 'arpeggio.type4',
    label: 'Type 4',
    hint: '並び順が違う分散を別の手で',
    humanTemplateId: HUMAN_TEMPLATE_ARPEGGIO_P1_A11,
    offered: false,
  },
  {
    id: 'arpeggio.type5',
    label: 'Type 5',
    hint: '別の曲から起こした、動きの大きい分散',
    humanTemplateId: HUMAN_TEMPLATE_ARPEGGIO_P2_A10,
    offered: false,
  },
  {
    id: 'arpeggio.legacy1',
    label: '旧 Type 1',
    hint: '旧アルペジオ Type1',
    humanTemplateId: HUMAN_TEMPLATE_ARPEGGIO_P1_C10,
    offered: false,
  },
  {
    id: 'arpeggio.legacy2',
    label: '旧 Type 2',
    hint: '旧アルペジオ Type2',
    humanTemplateId: HUMAN_TEMPLATE_ARPEGGIO_P1_A10,
    offered: false,
  },
  {
    id: 'arpeggio.legacy3',
    label: '旧 Type 3',
    hint: '旧アルペジオ Type3',
    humanTemplateId: HUMAN_TEMPLATE_ARPEGGIO_P1_C11,
    offered: false,
  },
];

const NATURAL_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'natural.type1',
    label: 'Type 1',
    hint: '標準のナチュラル。素直に弾く',
    humanTemplateId: HUMAN_TEMPLATE_NORMAL_P1_A1,
  },
  {
    id: 'natural.type2',
    label: 'Type 2',
    hint: '同じ伴奏を別の手で',
    humanTemplateId: HUMAN_TEMPLATE_NORMAL_P1_C1,
  },
  {
    id: 'natural.type3',
    label: 'Type 3',
    hint: 'もう少し動きのあるナチュラル',
    humanTemplateId: HUMAN_TEMPLATE_NORMAL_P1_A3,
  },
  {
    id: 'natural.auto',
    label: 'おまかせ',
    hint: '4 小節ごとにベースの譜割りが変わる',
    bank: NATURAL_BANK,
    offered: false,
  },
  {
    id: 'natural.steady',
    label: 'Steady',
    hint: 'すべての裏拍にベース',
    bank: [NATURAL_COMP],
    offered: false,
  },
  {
    id: 'natural.sparse',
    label: 'Sparse',
    hint: '2 拍・4 拍の裏だけ、隙間を多く',
    bank: [NATURAL_COMP_SPARSE],
    offered: false,
  },
  {
    id: 'natural.dense',
    label: 'Dense',
    hint: '2 拍目にもベースを置いて厚く',
    bank: [NATURAL_COMP_DENSE],
    offered: false,
  },
];

const CITY_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'city.type1',
    label: 'Type 1',
    hint: '短いコード、意図的な休符、控えめな構成音の間引き',
  },
];

// Driving is the tempo-adaptive reading; the fixed 8- and 16-feels it used to offer
// are now rhythms of their own, where they can carry their own bar and variants.
const DRIVING_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'driving.auto',
    label: 'おまかせ',
    hint: 'テンポとドラムで 8 / 16 を選ぶ',
  },
  {
    id: 'driving.push',
    label: 'Push',
    hint: '食いを 1 拍前まで広げて突っ込む',
    refine: { anticipation: { maxLeadBeats: 1 }, accentDepthDelta: 3 },
  },
  {
    id: 'driving.tight',
    label: 'Tight',
    hint: '短く切って前のめりに',
    refine: { gate: { min: 0.55, max: 0.78 }, accentDepthDelta: 5 },
  },
];

const RELAXED_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'relaxed.type1',
    label: 'Type 1',
    hint: '長く伸ばす標準のバラード',
    humanTemplateId: HUMAN_TEMPLATE_BALLAD_P1_C7,
    offered: false,
  },
  {
    id: 'relaxed.type2',
    label: 'Type 2',
    hint: '同じバラードを別の手で。高い音域が切ない',
    humanTemplateId: HUMAN_TEMPLATE_BALLAD_P1_A7,
    offered: false,
  },
  {
    id: 'relaxed.type3',
    label: 'Type 3',
    hint: 'もう少し動きのあるバラード',
    humanTemplateId: HUMAN_TEMPLATE_BALLAD_P1_C8,
    offered: false,
  },
  {
    id: 'relaxed.type4',
    label: 'Type 4',
    hint: '動きのあるバラードを別の手で',
    humanTemplateId: HUMAN_TEMPLATE_BALLAD_P1_A8,
    offered: false,
  },
  {
    id: 'relaxed.type5',
    label: 'Type 5',
    hint: '別の曲から起こした、ゆったりしたバラード',
    humanTemplateId: HUMAN_TEMPLATE_BALLAD_P4_A7,
    offered: false,
  },
];

const BEAT8_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'beat8.pop',
    label: 'ポップ',
    hint: '表拍と裏拍を混ぜた標準の 8 ビート',
  },
  {
    id: 'beat8.simple',
    label: 'シンプル',
    hint: '和音は 1・3 拍だけ。低音の刻みを立たせる',
    refine: { chord: HALVES },
  },
  {
    id: 'beat8.drive',
    label: 'ドライブ',
    hint: '食いを 1 拍前まで広げて前へ',
    refine: { anticipation: { maxLeadBeats: 1 }, accentDepthDelta: 4 },
  },
  {
    id: 'beat8.open',
    label: 'オープン',
    hint: '長めに伸ばして余白を残す',
    refine: { gate: { min: 0.88, max: 0.99 } },
  },
];

const BEAT16_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'beat16.city',
    label: 'シティ',
    hint: '表拍と 16 分裏を混ぜた標準の 16 ビート',
  },
  {
    id: 'beat16.sparse',
    label: 'スパース',
    hint: '休符を増やして息をさせる',
    refine: { chord: BEAT16_SPARSE_CHORD },
  },
  {
    id: 'beat16.funk',
    label: 'ファンク',
    hint: '16 分裏を強調して跳ねる',
    refine: { chord: BEAT16_FUNK_CHORD, accentDepthDelta: 4 },
  },
  {
    id: 'beat16.push',
    label: 'プッシュ',
    hint: '食いを広げて前へ',
    refine: { anticipation: { maxLeadBeats: 0.75 }, accentDepthDelta: 3 },
  },
];

const SHUFFLE_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'shuffle.blues',
    label: 'ブルース',
    hint: '三連の長短で自然に跳ねる',
  },
  {
    id: 'shuffle.simple',
    label: 'シンプル',
    hint: '和音は 1・3 拍だけ',
    refine: { chord: HALVES },
  },
  {
    id: 'shuffle.hard',
    label: 'ハード',
    hint: 'アクセントを強く、短めに切る',
    refine: { accentDepthDelta: 6, gate: { min: 0.55, max: 0.78 } },
  },
];

const SWING_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'swing.soft',
    label: 'ソフト',
    hint: '裏拍中心のやわらかい揺れ',
  },
  {
    id: 'swing.walk',
    label: 'ウォーク',
    hint: 'ベースの 4 分を目立たせる',
    refine: { accentDepthDelta: -4, gate: { min: 0.78, max: 0.95 } },
  },
  {
    id: 'swing.comp',
    label: 'コンプ',
    hint: '和音を短く切って応答する',
    refine: { gate: { min: 0.4, max: 0.62, sustain: 'normal' } },
  },
];

const BOSSA_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'bossa.light',
    label: 'ライト',
    hint: '低音と和音を交互に、軽く落ち着いて',
  },
  {
    id: 'bossa.soft',
    label: 'ソフト',
    hint: 'さらに弱く、余韻を残す',
    refine: { gate: { min: 0.65, max: 0.88 }, accentDepthDelta: -4 },
  },
  {
    id: 'bossa.busy',
    label: 'ビジー',
    hint: 'シンコペを少し増やして動かす',
    refine: {
      chord: {
        hits: [o, X, X, X, o, X, X, o],
        accent: [0.4, 0.6, 0.75, 0.5, 0.4, 0.58, 0.72, 0.4],
      },
    },
  },
];

const REGGAE_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'reggae.skank',
    label: 'スカンク',
    hint: '2・4 拍の短いスカット',
  },
  {
    id: 'reggae.offbeat',
    label: 'オフビート',
    hint: '各拍の裏だけを短く鳴らす',
    refine: {
      chord: {
        hits: [o, X, o, X, o, X, o, X],
        accent: [0.4, 0.9, 0.4, 0.85, 0.4, 0.9, 0.4, 0.85],
      },
    },
  },
  {
    id: 'reggae.deep',
    label: 'ディープ',
    hint: '低音を長めに、スカットは短く',
    refine: {
      gate: { min: 0.18, max: 0.34, sustain: 'staccato', byTrack: { bass: { min: 0.7, max: 0.92 } } },
    },
  },
];

const SIX_EIGHT_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'sixEight.flow',
    label: 'フロー',
    hint: '1・2・3、4・5・6 で揺れる分散',
  },
  {
    id: 'sixEight.simple',
    label: 'シンプル',
    hint: '1 と 4 だけに和音を置く',
    refine: {
      chord: {
        hits: [X, o, o, X, o, o],
        accent: [1.0, 0.4, 0.4, 0.88, 0.4, 0.4],
      },
      arpeggio: null,
    },
  },
  {
    id: 'sixEight.open',
    label: 'オープン',
    hint: '長く伸ばして余韻を残す',
    refine: { gate: { min: 0.9, max: 0.99 } },
  },
];

const WALTZ_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'waltz.oomPah',
    label: 'ズンチャッ',
    hint: '1 拍目に低音、2・3 拍に和音',
  },
  {
    id: 'waltz.soft',
    label: 'ソフト',
    hint: 'チャッをさらに弱く',
    refine: { accentDepthDelta: -6, gate: { min: 0.55, max: 0.8 } },
  },
  {
    id: 'waltz.flow',
    label: 'フロー',
    hint: '和音を分散させて流す',
    refine: {
      chord: {
        hits: [o, X, X, X, X, X],
        accent: [0.4, 0.55, 0.7, 0.5, 0.65, 0.5],
      },
      arpeggio: { direction: 'up' },
      gate: { min: 0.65, max: 0.88, sustain: 'normal' },
    },
  },
];

/** Every accompaniment's variants, in chip order. Index 0 is always the default. */
export const VARIANT_CATALOG = {
  block: BLOCK_VARIANTS,
  arpeggio: ARPEGGIO_VARIANTS,
  natural: NATURAL_VARIANTS,
  city: CITY_VARIANTS,
  driving: DRIVING_VARIANTS,
  relaxed: RELAXED_VARIANTS,
  beat8: BEAT8_VARIANTS,
  beat16: BEAT16_VARIANTS,
  shuffle: SHUFFLE_VARIANTS,
  swing: SWING_VARIANTS,
  bossa: BOSSA_VARIANTS,
  reggae: REGGAE_VARIANTS,
  sixEight: SIX_EIGHT_VARIANTS,
  waltz: WALTZ_VARIANTS,
} as const satisfies Record<AccompanimentPattern, readonly AccompanimentVariant[]>;
