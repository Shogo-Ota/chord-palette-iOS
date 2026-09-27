import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { harmonicRoleVisuals } from '@/lib/videoExport/harmonicRoleVisuals';
import { HARMONIC_VISUAL_TOKENS } from '@/theme/videoHarmonicTokens';
import type { ChordEvent, ChordFunction } from '@/types';

/**
 * The accepted values, pinned.
 *
 * The sibling gate checks that the implementation is wired the right way round; this one checks
 * that the numbers themselves do not drift. They were settled by looking at exported video on a
 * device, not by reasoning about colour, so there is nothing in the code that would catch a
 * plausible-looking edit to them — only this file.
 *
 * Changing a value here means the frozen presentation changed. Do that when measured audience
 * data says to, and record the new numbers in
 * `docs/acceptance/video-harmonic-role-visual-freeze.md`.
 */
const IOS = join(process.cwd(), 'modules', 'chord-video-export', 'ios');
const source = (file: string) => readFileSync(join(IOS, file), 'utf8');

/** The two families tuned away from their glow, and the reason each was. */
const TUNED_AURAS = {
  // Borrowed and chromatic-mediant chords. Deep, so an amber `Fm` stays amber on screen.
  color: '#4c1d95',
  // Dominant substitutes. Deeper than the cyan glow so the glow keeps the letters.
  substitute: '#0891b2',
} as const;

describe('the accepted aura values are frozen', () => {
  it.each(Object.entries(TUNED_AURAS))('pins %s to %s', (family, value) => {
    expect(HARMONIC_VISUAL_TOKENS[family as keyof typeof HARMONIC_VISUAL_TOKENS].aura).toBe(value);
  });

  /**
   * Every family that was not deliberately tuned keeps the value it had before `aura` existed,
   * which is what makes the field a no-op for them. `leadingTension` is called out because
   * `G#dim7` was the regression control for the change that introduced it.
   */
  it('leaves leadingTension on the colour its glow already used', () => {
    expect(HARMONIC_VISUAL_TOKENS.leadingTension.aura).toBe(
      HARMONIC_VISUAL_TOKENS.leadingTension.glowOuter,
    );
    expect(HARMONIC_VISUAL_TOKENS.leadingTension.aura).toBe('#f038e8');
  });

  it('leaves every untuned family on its glow colour', () => {
    for (const [name, token] of Object.entries(HARMONIC_VISUAL_TOKENS)) {
      if (name in TUNED_AURAS) continue;
      expect({ name, aura: token.aura }).toEqual({ name, aura: token.glowOuter });
    }
  });
});

describe('the aura reaches the backdrop and nothing else', () => {
  it('is never read by the glyph renderer', () => {
    const glyph = source('FlowChordGlyphRenderer.swift');
    expect(glyph).not.toMatch(/\blayers\.aura\b/);
    expect(glyph).not.toMatch(/roleColors/);
  });

  it('is never read by the falling blocks or the keyboard', () => {
    for (const file of ['FlowFallingBlockRenderer.swift', 'FlowKeyboardRenderer.swift']) {
      expect({ file, mentionsRole: /aura|roleColors|rolePalette/i.test(source(file)) }).toEqual({
        file,
        mentionsRole: false,
      });
    }
  });

  it('is read by the hero bloom and the frame backdrop', () => {
    expect(source('FlowClassicChordHeroRenderer.swift')).toContain(
      'color: roleColors?.aura ?? segment.color',
    );
    expect(source('FlowFrameRenderer.swift')).toContain('color: roleColors.aura');
  });
});

describe('an ordinary progression is still untouched', () => {
  const event = (fn: ChordFunction): ChordEvent =>
    ({ function: fn, category: 'diatonic' }) as unknown as ChordEvent;

  /**
   * The whole system rests on this: a progression with nothing advanced in it sends no palette
   * at all, so the renderer cannot tint it even by accident. Lighting every chord marks none.
   */
  it('sends no palette for a diatonic-only progression', () => {
    const diatonic = [event('tonic'), event('subdominant'), event('dominant'), event('tonic')];
    expect(harmonicRoleVisuals(diatonic, 'major')).toEqual([]);
    expect(harmonicRoleVisuals(diatonic, 'minor')).toEqual([]);
  });
});

describe('Classic was not part of this work', () => {
  /**
   * Classic is frozen on its output, not merely on its source, so it must not learn about roles
   * at all — not even by reading a field it would then ignore.
   */
  it('never mentions the role palette', () => {
    for (const file of ['FrameRenderer.swift', 'ClassicFrameRendererAdapter.swift']) {
      expect({ file, mentionsRole: /harmonicRole|rolePalette|roleColors|aura/i.test(source(file)) }).toEqual(
        { file, mentionsRole: false },
      );
    }
  });
});
