/**
 * The style-card catalog (UI洗練化指示書 §5–6) — pure data, no React Native.
 *
 * Five cards answer 「どのような伴奏にしたいか」 in the player's language. Only
 * the styles the engine can honestly differentiate today are selectable (指示書
 * §5 案B+案C): Ballad rides the Ballad Engine v1 (`relaxed`), Band the 8-beat
 * pop/rock skeleton, City the 16-beat comp. Dance (four-on-the-floor) and R&B
 * (half-time, ghosted) have no matching internal pattern yet, so they show as
 * 準備中 rather than faking a difference that isn't there.
 *
 * Selecting a card applies its recommended rhythm + drum groove (指示書 §13:
 * the style picks the rhythm internally). The card highlighted for a given
 * session is derived from the existing axis metadata (`axesFor`), so a project
 * whose rhythm was chosen in 詳細設定 still lights up its style family.
 */

import type { AccompanimentPattern, GrooveId } from '@/types';

import { axesFor } from './axes';
import type { AccompanimentStyle } from './types';

export interface StyleCardDef {
  readonly id: AccompanimentStyle;
  /** Card title, e.g. "Ballad". */
  readonly label: string;
  /** One-breath mood line, e.g. "ゆったり・感情的". */
  readonly tagline: string;
  /** What actually plays, in the player's language (no fake instrumentation). */
  readonly description: string;
  readonly status: 'ready' | 'comingSoon';
  /** What tapping the card selects. Present exactly when status is 'ready'. */
  readonly recommends?: {
    readonly pattern: AccompanimentPattern;
    readonly grooveId: GrooveId;
  };
}

export const STYLE_CARDS: readonly StyleCardDef[] = [
  {
    id: 'ballad',
    label: 'Ballad',
    tagline: 'ゆったり・感情的',
    description: '余白を活かした、ピアノ中心のしっとりした伴奏',
    status: 'ready',
    recommends: { pattern: 'relaxed', grooveId: 'pop8' },
  },
  {
    id: 'band',
    label: 'Band',
    tagline: '力強い・疾走感',
    description: '8 ビートで前へ進む、王道のバンド感',
    status: 'ready',
    recommends: { pattern: 'beat8', grooveId: 'pop8' },
  },
  {
    id: 'city',
    label: 'City',
    tagline: '都会的・洗練',
    description: '16 ビートで細かく刻む、滑らかなコードワーク',
    status: 'ready',
    recommends: { pattern: 'beat16', grooveId: 'soul16' },
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

/** The card a rhythm id belongs to (axis metadata), or `undefined` off-catalog. */
export function styleForRhythm(patternId: string): AccompanimentStyle | undefined {
  return axesFor(patternId)?.style;
}

/** Card lookup by id. */
export function styleCard(id: AccompanimentStyle): StyleCardDef {
  return STYLE_CARDS.find((c) => c.id === id)!;
}
