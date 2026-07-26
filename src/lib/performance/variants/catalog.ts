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
import { NATURAL_COMP } from '../styles/naturalComp';
import { NATURAL_COMP_DENSE } from '../styles/naturalCompDense';
import { NATURAL_COMP_SPARSE } from '../styles/naturalCompSparse';
import { SIXTEEN_BEAT } from '../styles/sixteenBeat';
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

/* ------------------------------------------------------------------ */
/* The catalog                                                         */
/* ------------------------------------------------------------------ */

const BLOCK_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'block.hold',
    label: 'Hold',
    hint: '1 小節に 1 回、伸ばす',
  },
  {
    id: 'block.half',
    label: 'Half',
    hint: '1 拍目と 3 拍目で打ち直す',
    refine: { chord: HALVES, bass: HALVES },
  },
  {
    id: 'block.push',
    label: 'Push',
    hint: '次のコードを 8 分早く食う',
    refine: { anticipation: { maxLeadBeats: 0.5 }, chord: HALVES, bass: HALVES },
  },
  {
    id: 'block.stab',
    label: 'Stab',
    hint: 'short に切って余白を作る',
    // The point of a stab is the silence after it, so the long-tone articulation goes
    // with the long gate — otherwise the note would still be labelled legato.
    refine: { gate: { min: 0.24, max: 0.42, sustain: 'normal' } },
  },
];

const ARPEGGIO_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'arpeggio.upDown',
    label: 'Up & Down',
    hint: '上がって下がる往復',
  },
  {
    id: 'arpeggio.up',
    label: 'Up',
    hint: '低い音から上へ流れ続ける',
    refine: { arpeggio: { direction: 'up' } },
  },
  {
    id: 'arpeggio.eighth',
    label: '8th',
    hint: '8 分でゆったり分散',
    refine: { chord: EIGHTHS_ON_16 },
  },
  {
    id: 'arpeggio.broken',
    label: 'Broken',
    hint: '1-5-3-7 と跳ねる分散',
    // Explicit cycle rather than a derived shape: the leap is the character, and the
    // index wraps on the note count so a triad still spells 1 5 3 1.
    refine: { arpeggio: { order: [0, 2, 1, 3] } },
  },
];

const NATURAL_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'natural.auto',
    label: 'おまかせ',
    hint: '4 小節ごとにベースの譜割りが変わる',
    bank: NATURAL_BANK,
  },
  {
    id: 'natural.steady',
    label: 'Steady',
    hint: 'すべての裏拍にベース',
    bank: [NATURAL_COMP],
  },
  {
    id: 'natural.sparse',
    label: 'Sparse',
    hint: '2 拍・4 拍の裏だけ、隙間を多く',
    bank: [NATURAL_COMP_SPARSE],
  },
  {
    id: 'natural.dense',
    label: 'Dense',
    hint: '2 拍目にもベースを置いて厚く',
    bank: [NATURAL_COMP_DENSE],
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
    id: 'driving.sixteen',
    label: '16 Beat',
    hint: '16 ビートで固定、細かく前へ',
    forcedBase: SIXTEEN_BEAT,
  },
  {
    id: 'driving.push',
    label: 'Push',
    hint: '食いを 1 拍前まで広げて突っ込む',
    refine: { anticipation: { maxLeadBeats: 1 }, accentDepthDelta: 3 },
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

const RELAXED_VARIANTS: readonly AccompanimentVariant[] = [
  {
    id: 'relaxed.ballad',
    label: 'Ballad',
    hint: '半小節ごとに置いて長く伸ばす',
  },
  {
    id: 'relaxed.sustain',
    label: 'Sustain',
    hint: '上声を止めて、和音だけを長く',
    refine: { top: null, gate: { min: 0.92, max: 0.99 } },
  },
  {
    id: 'relaxed.arp',
    label: 'Slow Arp',
    hint: '4 分でゆっくり分散させる',
    // The top voice would double the arpeggio's own line, so it steps aside.
    refine: {
      chord: QUARTERS_ON_8,
      top: null,
      arpeggio: { direction: 'up' },
      gate: { min: 0.7, max: 0.9, sustain: 'normal' },
    },
  },
];

/** Every accompaniment's variants, in chip order. Index 0 is always the default. */
export const VARIANT_CATALOG = {
  block: BLOCK_VARIANTS,
  arpeggio: ARPEGGIO_VARIANTS,
  natural: NATURAL_VARIANTS,
  driving: DRIVING_VARIANTS,
  relaxed: RELAXED_VARIANTS,
  beat8: BEAT8_VARIANTS,
} as const satisfies Record<AccompanimentPattern, readonly AccompanimentVariant[]>;
