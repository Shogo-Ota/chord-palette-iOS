/**
 * Style-card catalog contract (UI洗練化指示書 §5–6 / ブラッシュアップ指示).
 *
 * The cards must stay honest: a ready card carries a full internal preset
 * (rhythm, drum groove, 余韻, 音域) that round-trips through the selection
 * lookup — tapping a card highlights the card you tapped, and only styles the
 * engine can differentiate today are selectable.
 */

import { isRhythmId } from '@/lib/performance/rhythms';
import {
  cardForSelection,
  CORE_PATTERNS,
  STYLE_CARDS,
  styleCard,
} from '@/lib/performance/model/styleCards';

describe('style cards', () => {
  it('covers the five long-term styles, in the instruction order', () => {
    expect(STYLE_CARDS.map((c) => c.id)).toEqual(['ballad', 'band', 'city', 'dance', 'rnb']);
  });

  it('ready ⇔ preset: selectable cards say what they apply, 準備中 cards do not', () => {
    for (const card of STYLE_CARDS) {
      if (card.status === 'ready') expect(card.preset).toBeDefined();
      else expect(card.preset).toBeUndefined();
    }
  });

  it('every preset rhythm is a real catalog rhythm', () => {
    for (const card of STYLE_CARDS) {
      if (card.preset) expect(isRhythmId(card.preset.pattern)).toBe(true);
    }
  });

  it('tapping a card highlights that same card (selection round-trips)', () => {
    for (const card of STYLE_CARDS) {
      if (!card.preset) continue;
      expect(cardForSelection(card.preset.pattern, card.preset.grooveId)).toBe(card);
    }
  });

  it('a hand-tweaked selection highlights no card (honest "custom" state)', () => {
    expect(cardForSelection('beat8', 'pop8')).toBeUndefined();
    expect(cardForSelection('relaxed', 'soul16')).toBeUndefined();
  });

  it('the three honestly-differentiated engines are the ready ones', () => {
    const ready = STYLE_CARDS.filter((c) => c.status === 'ready').map((c) => c.id);
    expect(ready).toEqual(['ballad', 'band', 'city']);
    // Ballad rides the purpose-built Ballad Engine v1; Band and City follow the
    // ブラッシュアップ指示 preset table (driving+rock kit / raised arp+soul kit).
    expect(styleCard('ballad').preset).toEqual({
      pattern: 'relaxed',
      grooveId: 'pop8',
      releaseCut: false,
      octaveShift: 0,
    });
    expect(styleCard('band').preset).toEqual({
      pattern: 'driving',
      grooveId: 'rock8',
      releaseCut: false,
      octaveShift: 0,
    });
    expect(styleCard('city').preset).toEqual({
      pattern: 'arpeggio',
      grooveId: 'soul16',
      releaseCut: false,
      octaveShift: 1,
    });
  });

  it('詳細設定 exposes exactly the four beginner-safe rhythms', () => {
    expect(CORE_PATTERNS).toEqual(['block', 'arpeggio', 'natural', 'driving']);
    for (const id of CORE_PATTERNS) expect(isRhythmId(id)).toBe(true);
  });

  it('every card reads as a card: label, tagline and a 1–2 line description', () => {
    for (const card of STYLE_CARDS) {
      expect(card.label.length).toBeGreaterThan(0);
      expect(card.tagline.length).toBeGreaterThan(0);
      expect(card.description.length).toBeGreaterThan(0);
      expect(card.description.length).toBeLessThanOrEqual(40);
    }
  });
});
