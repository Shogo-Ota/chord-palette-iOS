/**
 * Style-card catalog contract (UI洗練化指示書 §5–6).
 *
 * The cards must stay honest: a ready card's recommended rhythm really belongs
 * to that style family (so tapping the card highlights the card you tapped),
 * and only styles the engine can differentiate today are selectable.
 */

import { isRhythmId } from '@/lib/performance/rhythms';
import { STYLE_CARDS, styleCard, styleForRhythm } from '@/lib/performance/model/styleCards';

describe('style cards', () => {
  it('covers the five long-term styles, in the instruction order', () => {
    expect(STYLE_CARDS.map((c) => c.id)).toEqual(['ballad', 'band', 'city', 'dance', 'rnb']);
  });

  it('ready ⇔ recommends: selectable cards say what they play, 準備中 cards do not', () => {
    for (const card of STYLE_CARDS) {
      if (card.status === 'ready') expect(card.recommends).toBeDefined();
      else expect(card.recommends).toBeUndefined();
    }
  });

  it('every recommendation is a real catalog rhythm of the card\'s own family', () => {
    for (const card of STYLE_CARDS) {
      if (!card.recommends) continue;
      expect(isRhythmId(card.recommends.pattern)).toBe(true);
      // Tapping a card must light up that same card, not a sibling.
      expect(styleForRhythm(card.recommends.pattern)).toBe(card.id);
    }
  });

  it('the three honestly-differentiated engines are the ready ones', () => {
    const ready = STYLE_CARDS.filter((c) => c.status === 'ready').map((c) => c.id);
    expect(ready).toEqual(['ballad', 'band', 'city']);
    expect(styleCard('ballad').recommends?.pattern).toBe('relaxed');
    expect(styleCard('band').recommends?.pattern).toBe('beat8');
    expect(styleCard('city').recommends?.pattern).toBe('beat16');
  });

  it('every card reads as a card: label, tagline and description are non-empty', () => {
    for (const card of STYLE_CARDS) {
      expect(card.label.length).toBeGreaterThan(0);
      expect(card.tagline.length).toBeGreaterThan(0);
      expect(card.description.length).toBeGreaterThan(0);
    }
  });

  it('all 13 selector rhythms resolve to some style family (no orphan highlight)', () => {
    for (const id of [
      'block', 'arpeggio', 'natural', 'driving', 'relaxed', 'beat8', 'beat16',
      'shuffle', 'swing', 'bossa', 'reggae', 'sixEight', 'waltz',
    ]) {
      expect(styleForRhythm(id)).toBeDefined();
    }
  });
});
