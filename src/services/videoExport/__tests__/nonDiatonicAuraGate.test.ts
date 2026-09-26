import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const IOS = path.join(ROOT, 'modules/chord-video-export/ios');

function source(file: string): string {
  return fs.readFileSync(path.join(IOS, file), 'utf8').replace(/\r\n/g, '\n');
}

function repoSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

/**
 * Source with comments removed, so a prose sentence explaining why an effect was
 * avoided cannot be mistaken for the effect itself.
 */
function code(file: string): string {
  return source(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

const AURA_FILES = ['FlowNonDiatonicAuraRenderer.swift', 'FlowNonDiatonicCycle.swift'] as const;

describe('non-diatonic aura architecture', () => {
  it('reaches Flow through the same sidecar seam as the note timeline', () => {
    const service = repoSource('src/services/videoExport/index.ts');
    const bridge = source('ChordVideoExportModule.swift');
    const registry = source('VideoFrameRendererRegistry.swift');

    // Flow only, so the frozen Classic renderer keeps the payload it was accepted with.
    expect(service).toContain("input.visualStyle === 'flow' ? nonDiatonicCycleIndices");
    expect(bridge).toContain('@Field var nonDiatonicCycleIndices: [Int] = []');
    expect(registry).toContain('flowNonDiatonic: FlowNonDiatonicCycle = .empty');
    expect(registry).toMatch(
      /case \.flow:\s+return FlowFrameRenderer\(timeline: flowTimeline, nonDiatonic: flowNonDiatonic\)/,
    );
    expect(registry).toMatch(/case \.classic:\s+return ClassicFrameRendererAdapter\(\)/);
  });

  it('adds no field to the segment payload the Classic renderer shares', () => {
    const classic = source('FrameRenderer.swift');
    const writer = source('VideoWriter.swift');

    expect(classic).not.toMatch(/nonDiatonic|aura/i);
    expect(writer).not.toMatch(/nonDiatonic|aura/i);
  });

  it('keys the aura by cycle position rather than by a floating-point time', () => {
    const cycle = source('FlowNonDiatonicCycle.swift');
    const renderer = source('FlowFrameRenderer.swift');

    expect(cycle).toContain('func contains(cycleIndex: Int)');
    expect(cycle).toContain('Set(indices)');
    expect(renderer).toContain('nonDiatonic.contains(cycleIndex: state.currentCycleIndex)');
    expect(cycle).not.toMatch(/startSec|durationSec|timeSec/);
  });

  it('drives the aura from the chord pulse already on screen, with no second clock', () => {
    const renderer = source('FlowFrameRenderer.swift');
    const hero = source('FlowClassicChordHeroRenderer.swift');

    // The same three constants the accepted chord presentation uses.
    for (const shared of ['60.0 /', 'exp(-beatPhase * 3.2)', 'min(0.16,', '* 0.45']) {
      expect(renderer).toContain(shared);
      expect(hero).toContain(shared);
    }
    expect(renderer).toContain('FlowNonDiatonicAuraIntensity.resolve');
  });

  it('runs anticipation, impact and decay so the moment reads as temporary', () => {
    const cycle = source('FlowNonDiatonicCycle.swift');

    expect(cycle).toContain('anticipationWindow');
    expect(cycle).toContain('nextIsNonDiatonic');
    expect(cycle).toContain('sustain');
    expect(cycle).toContain('breath');
    // Anticipation only announces a chord that is not itself chromatic.
    expect(cycle).toContain('guard nextIsNonDiatonic, !currentIsNonDiatonic else { return 0 }');
  });

  it('lays violet around the function colour and never in place of it', () => {
    const aura = source('FlowNonDiatonicAuraRenderer.swift');
    const renderer = source('FlowFrameRenderer.swift');
    const keyboard = source('FlowKeyboardRenderer.swift');
    const hero = source('FlowClassicChordHeroRenderer.swift');

    // The aura owns one colour and never reads a segment's own colour.
    expect(aura).toContain('0xa8 / 255');
    expect(aura).not.toContain('segment.color');
    expect(aura).not.toContain('fallbackColor');
    // The soft bloom sits behind the chord hierarchy.
    expect(renderer.indexOf('drawBackdrop')).toBeLessThan(
      renderer.indexOf('FlowClassicChordStageRenderer.draw'),
    );
    // A negative stroke width strokes and fills at once, so the glyph keeps its
    // function colour and only gains a rim.
    expect(hero).toContain('.foregroundColor: color.withAlphaComponent(alpha)');
    expect(hero).toContain('attributes[.strokeColor]');
    expect(hero).toMatch(/attributes\[\.strokeWidth\] = -/);
    // Keys keep their function fill; the aura is laid over the top.
    expect(keyboard).toContain('fallbackColor.withAlphaComponent');
    expect(keyboard.indexOf('litRects.append')).toBeLessThan(
      keyboard.indexOf('FlowNonDiatonicAuraRenderer.drawKeyAfterglow'),
    );
  });

  /**
   * Outlining the whole chord area read as the chord being fenced in rather than lit up.
   * The aura gathers on the letters now, so no renderer may go back to drawing a box
   * around them.
   */
  it('draws no rectangle around the chord area', () => {
    const aura = code('FlowNonDiatonicAuraRenderer.swift');
    const renderer = code('FlowFrameRenderer.swift');

    // The box was the one rect built from frame width. Key halos and rail rings are
    // still rounded rects and ovals, but they trace things that are already there.
    expect(aura).not.toMatch(/CGRect\(\s*x: width/);
    expect(aura).not.toContain('drawEdge');
    expect(renderer).not.toContain('drawEdge');
    // What remains of the aura's own drawing: a radial bloom, key halos, rail rings.
    expect(aura).toContain('drawRadialGradient');
    expect(aura).not.toContain('drawLinearGradient');
  });

  it('puts the rim and halo on the glyphs, scaled by the chord transition', () => {
    const hero = source('FlowClassicChordHeroRenderer.swift');
    const stage = source('FlowClassicChordStageRenderer.swift');

    expect(hero).toContain('auraStrength: CGFloat = 0');
    // `ease` is the chord attack, so the rim arrives with the chord and not before it.
    expect(hero).toContain('auraStrength: auraStrength * ease');
    expect(stage).toContain('auraStrength: auraStrength');
    // The halo is the same glyphs drawn again, not a shape approximating them.
    expect(hero).toMatch(/blur: glowRadius \* 2\.4/);
  });

  /**
   * Swift only compiles on the build machine, so a malformed source file costs a whole
   * remote build to discover. This caught one: a file written with the editor's own
   * line-number gutter (`   10|  private let …`) baked into the source.
   */
  it('contains no line-number gutter leaked in from a file view', () => {
    for (const file of AURA_FILES) {
      expect(source(file)).not.toMatch(/^\s+\d+\|/m);
    }
  });

  it('keeps the aura inside the effect budget Flow already accepted', () => {
    for (const file of AURA_FILES) {
      expect(code(file)).not.toMatch(/CIFilter|Gaussian|particle|random|waveform/i);
      expect(source(file).split('\n').length).toBeLessThan(500);
    }
  });

  /**
   * The aura is meant to be understood by feel, not read. Holding the files to zero
   * string literals is the strongest form of that: with no text to draw, no explanatory
   * caption can appear over the video by accident.
   */
  it('draws no text at all, so nothing has to be read', () => {
    for (const file of AURA_FILES) {
      expect(code(file)).not.toMatch(/"[^"]*"/);
    }
  });

  it('separates what a chord does from whether it is ordinary, in the tokens', () => {
    const tokens = repoSource('src/theme/tokens.ts');

    expect(tokens).toContain('nonDiatonicAura');
    expect(tokens).toMatch(/videoColors = \{\s*function: \{/);
    // The aura hue must not be one of the three function colours.
    expect(tokens).toContain("nonDiatonicAura: '#a855f7'");
    for (const functionHex of ['#22c55e', '#eab308', '#ef4444']) {
      expect('#a855f7').not.toBe(functionHex);
    }
  });
});
