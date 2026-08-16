/**
 * What the 伴奏設定 screen may offer, and what the retired style cards must no
 * longer be able to do.
 *
 * The old five-card selector (Ballad / Band / City / Dance / R&B) applied a full
 * internal preset on tap, which is how a session could end up on `driving` or
 * `beat16` — rhythms the screen cannot show as selected. The cards are gone, and
 * these tests keep them gone while the style AXIS the engine reads stays intact.
 */

import * as styleCards from '@/lib/performance/model/styleCards';
import { CORE_PATTERNS, styleForRhythm } from '@/lib/performance/model/styleCards';
import { isRhythmId } from '@/lib/performance/rhythms';

describe('伴奏パターン exposure', () => {
  it('keeps the four Production rhythm families explicit', () => {
    expect(CORE_PATTERNS).toEqual(['block', 'natural', 'city', 'arpeggio']);
    for (const id of CORE_PATTERNS) expect(isRhythmId(id)).toBe(true);
  });

  it('offers no card that writes a rhythm into the session', () => {
    expect(Object.keys(styleCards).sort()).toEqual(['CORE_PATTERNS', 'styleForRhythm']);
  });
});

describe('style axis (internal metadata, kept for saved projects)', () => {
  it('still classifies every rhythm a saved project may carry', () => {
    // `driving` / `beat16` / `relaxed` are no longer selectable, but projects
    // saved on them must keep resolving to a style the engine has profiles for.
    expect(styleForRhythm('natural')).toBe('band');
    expect(styleForRhythm('driving')).toBe('band');
    expect(styleForRhythm('beat16')).toBe('city');
  });

  it('classifies the four Production rhythms', () => {
    for (const id of CORE_PATTERNS) expect(styleForRhythm(id)).toBeDefined();
  });

  it('leaves an unknown rhythm unclassified rather than guessing', () => {
    expect(styleForRhythm('bogus')).toBeUndefined();
  });
});
