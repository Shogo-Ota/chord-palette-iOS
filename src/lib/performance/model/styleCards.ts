/**
 * The style-card catalog (UI洗練化指示書 §5–6 / ブラッシュアップ指示) — pure
 * data, no React Native.
 *
 * Five cards answer 「どのような伴奏にしたいか」 in the player's language. Only
 * the styles the engine can honestly differentiate today are selectable:
 * Ballad rides the Ballad Engine v1 (`relaxed`), Band the drum-locked driving
 * feel over the harder rock kit, City a raised, flowing 16th arpeggio over the
 * soul kit. Dance (four-on-the-floor) and R&B (half-time, ghosted) have no
 * matching internal pattern yet, so they show as 準備中 rather than faking a
 * difference that isn't there.
 *
 * A card carries a FULL internal preset (ブラッシュアップ指示: スタイルを選ぶ
 * だけで内部設定を自動切替): rhythm, drum groove, 余韻 (release cut) and 音域
 * (octave shift). The drum-groove selector no longer exists in the UI — the
 * style decides it. The highlighted card is the one whose rhythm+groove pair
 * the session currently matches; hand-tweaked sessions highlight none.
 */

import type { AccompanimentPattern, GrooveId } from '@/types';

import { axesFor } from './axes';
import type { AccompanimentStyle } from './types';

/** Everything a style choice sets internally. */
export interface StyleCardPreset {
  readonly pattern: AccompanimentPattern;
  readonly grooveId: GrooveId;
  /** 余韻: false = 自然（伸ばす）, true = 短め. */
  readonly releaseCut: boolean;
  /** 音域: 0 = 標準, 1 = 高め. */
  readonly octaveShift: 0 | 1;
}

export interface StyleCardDef {
  readonly id: AccompanimentStyle;
  /** Card title, e.g. "Ballad". */
  readonly label: string;
  /** One-breath mood line, e.g. "ゆったり・感情的". */
  readonly tagline: string;
  /** What actually plays, in the player's language (no fake instrumentation). */
  readonly description: string;
  readonly status: 'ready' | 'comingSoon';
  /** What tapping the card applies. Present exactly when status is 'ready'. */
  readonly preset?: StyleCardPreset;
}

export const STYLE_CARDS: readonly StyleCardDef[] = [
  {
    id: 'ballad',
    label: 'Ballad',
    tagline: 'ゆったり・感情的',
    description: '余白を活かした、ピアノ中心のしっとりした伴奏',
    status: 'ready',
    // Ballad Engine v1 (`relaxed`) — the comp tuned for exactly this card.
    preset: { pattern: 'relaxed', grooveId: 'pop8', releaseCut: false, octaveShift: 0 },
  },
  {
    id: 'band',
    label: 'Band',
    tagline: '力強い・疾走感',
    description: '力強いビートで前へ進む、王道のバンド感',
    status: 'ready',
    preset: { pattern: 'driving', grooveId: 'rock8', releaseCut: false, octaveShift: 0 },
  },
  {
    id: 'city',
    label: 'City',
    tagline: '都会的・洗練',
    description: '高めの音域で細かく流れる、洗練されたコードワーク',
    status: 'ready',
    preset: { pattern: 'arpeggio', grooveId: 'soul16', releaseCut: false, octaveShift: 1 },
  },
  {
    id: 'dance',
    label: 'Dance',
    tagline: '踊れる・エネルギッシュ',
    description: 'ビートと反復を中心とした伴奏',
    status: 'comingSoon',
  },
  {
    id: 'rnb',
    label: 'R&B',
    tagline: 'グルーヴ・ソウルフル',
    description: '余白と後ノリを活かした伴奏',
    status: 'comingSoon',
  },
];

/**
 * The rhythms 詳細設定 exposes (ブラッシュアップ指示: 必要最低限のみ). The
 * other nine stay fully playable — saved projects and style presets keep
 * using them — they just are not offered as manual picks anymore.
 */
export const CORE_PATTERNS: readonly AccompanimentPattern[] = [
  'block',
  'arpeggio',
  'natural',
  'driving',
];

/**
 * The card the current selection came from: an exact rhythm+groove match with
 * a card's preset. A session tweaked by hand (or saved before cards existed)
 * matches none, which reads honestly as "custom".
 */
export function cardForSelection(
  pattern: string,
  grooveId: string,
): StyleCardDef | undefined {
  return STYLE_CARDS.find(
    (c) => c.preset && c.preset.pattern === pattern && c.preset.grooveId === grooveId,
  );
}

/** The style family a rhythm id belongs to (axis metadata). */
export function styleForRhythm(patternId: string): AccompanimentStyle | undefined {
  return axesFor(patternId)?.style;
}

/** Card lookup by id. */
export function styleCard(id: AccompanimentStyle): StyleCardDef {
  return STYLE_CARDS.find((c) => c.id === id)!;
}
