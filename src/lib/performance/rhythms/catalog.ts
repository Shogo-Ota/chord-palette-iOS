/**
 * The rhythm catalog — pure data, in selector order.
 *
 * The first five entries restate what the engine already did for the five original
 * accompaniments, so promoting the branch into a table changed no sound: the feels
 * still resolve through the Feel layer, and the two textures still bypass Variation
 * and groove-lock exactly as before.
 *
 * Everything after them is an authored rhythm — a skeleton of its own, played with
 * Variation and groove-lock so it breathes and agrees with the kit.
 */

import { ARPEGGIO } from '../styles/arpeggio';
import { BLOCK } from '../styles/block';
import { BOSSA } from '../styles/bossa';
import { EIGHT_BEAT } from '../styles/eightBeat';
import { REGGAE } from '../styles/reggae';
import { SHUFFLE } from '../styles/shuffle';
import { SIX_EIGHT } from '../styles/sixEight';
import { SIXTEEN_BEAT } from '../styles/sixteenBeat';
import { SWING } from '../styles/swing';
import { WALTZ } from '../styles/waltz';

import type { RhythmDefinition } from './types';
import {
  EIGHT_VARIATION,
  METERED_VARIATION,
  SIXTEEN_VARIATION,
  SPACE_VARIATION,
  SWUNG_VARIATION,
} from './variations';

export const RHYTHMS: readonly RhythmDefinition[] = [
  {
    id: 'block',
    label: 'ブロック',
    hint: '和音をそのまま置く、いちばん素直な伴奏',
    source: { kind: 'style', style: BLOCK },
  },
  {
    id: 'arpeggio',
    label: 'バリエーション',
    hint: '実演奏から起こした、動きのある伴奏',
    source: { kind: 'style', style: ARPEGGIO },
  },
  {
    id: 'natural',
    label: 'ナチュラル',
    hint: '実演奏から起こした、自然なポップスの伴奏',
    source: { kind: 'feel', feelId: 'natural' },
  },
  {
    id: 'city',
    label: 'シティ',
    hint: '短いコードと休符で、タイトに刻む伴奏',
    source: { kind: 'independent', beatsPerBar: 4 },
  },
  {
    id: 'driving',
    label: 'ドライブ',
    hint: 'テンポとドラムに合わせて前へ進む',
    source: { kind: 'feel', feelId: 'driving' },
  },
  {
    id: 'relaxed',
    label: 'バラード',
    hint: '長く伸ばして、拍の後ろに寄りかかる',
    source: { kind: 'feel', feelId: 'relaxed' },
  },
  {
    id: 'beat8',
    label: '8 ビート',
    hint: '1・3 拍に低音、裏拍を混ぜたポップス／ロック',
    source: {
      kind: 'style',
      style: EIGHT_BEAT,
      variation: EIGHT_VARIATION,
      grooveLock: true,
    },
  },
  {
    id: 'beat16',
    label: '16 ビート',
    hint: '16 分で細かく刻み、休符でグルーヴを作る',
    source: {
      kind: 'style',
      style: SIXTEEN_BEAT,
      variation: SIXTEEN_VARIATION,
      grooveLock: true,
    },
  },
  {
    id: 'shuffle',
    label: 'シャッフル',
    hint: '8 分を長短に跳ねるブルース／ポップロック',
    source: {
      kind: 'style',
      style: SHUFFLE,
      variation: SWUNG_VARIATION,
      grooveLock: true,
    },
  },
  {
    id: 'swing',
    label: 'スウィング',
    hint: 'シャッフルより柔らかく、ジャズ寄りの揺れ',
    source: {
      kind: 'style',
      style: SWING,
      variation: SWUNG_VARIATION,
      grooveLock: true,
    },
  },
  {
    id: 'bossa',
    label: 'ボサノバ',
    hint: '低音と和音を交互に、シンコペで軽く落ち着いて',
    source: {
      kind: 'style',
      style: BOSSA,
      variation: SPACE_VARIATION,
      grooveLock: true,
    },
  },
  {
    id: 'reggae',
    label: 'レゲエ',
    hint: '2・4 拍の短いスカット。低音は表拍',
    source: {
      kind: 'style',
      style: REGGAE,
      variation: SPACE_VARIATION,
      grooveLock: true,
    },
  },
  {
    id: 'sixEight',
    label: '6/8 バラード',
    hint: '1・2・3、4・5・6。1 と 4 にアクセント',
    source: {
      kind: 'style',
      style: SIX_EIGHT,
      variation: METERED_VARIATION,
      grooveLock: true,
    },
  },
  {
    id: 'waltz',
    label: 'ワルツ',
    hint: '3/4 のズン・チャッ・チャッ',
    source: {
      kind: 'style',
      style: WALTZ,
      variation: METERED_VARIATION,
      grooveLock: true,
    },
  },
];
