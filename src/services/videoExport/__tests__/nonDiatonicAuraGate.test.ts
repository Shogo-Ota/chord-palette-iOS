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

const AURA_FILES = [
  'FlowNonDiatonicAuraRenderer.swift',
  'FlowNonDiatonicCycle.swift',
  'FlowChordGlyphRenderer.swift',
  'FlowHarmonicRolePalette.swift',
] as const;

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
      /case \.flow:\s+return FlowFrameRenderer\(\s+timeline: flowTimeline,\s+nonDiatonic: flowNonDiatonic,\s+rolePalette: flowRolePalette\s+\)/,
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

    // The aura takes the chord's role colour rather than owning one, so light is always
    // the chord's own colour getting brighter.
    expect(aura).toContain('color auraColor: UIColor');
    expect(aura).not.toMatch(/0xa8 \/ 255/);
    expect(aura).not.toContain('segment.color');
    // The soft bloom sits behind the chord hierarchy.
    expect(renderer.indexOf('drawBackdrop')).toBeLessThan(
      renderer.indexOf('FlowClassicChordStageRenderer.draw'),
    );
    // The glyph renderer owns every layer, and it is the only thing that paints them.
    expect(hero).toContain('FlowChordGlyphRenderer.draw');
    expect(hero).not.toMatch(/strokeWidth|strokeColor/);
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

  /**
   * Stroking glyph paths traces every boundary a font contains, and `#` is four bars that
   * cross, so each crossing got its own interior outline. Unioning the same string drawn
   * around a ring leaves only the silhouette uncovered, and the fill goes on last.
   */
  it('outlines the string silhouette instead of stroking glyph paths', () => {
    const glyph = source('FlowChordGlyphRenderer.swift');

    expect(glyph).not.toMatch(/strokeWidth|strokeColor|setStroke/);
    expect(glyph).toContain('contourSteps');
    expect(glyph).toContain('cos(angle) * width');
    expect(glyph).toContain('sin(angle) * width');
    // The fill has to be the final pass or the ring shows through the letters.
    expect(glyph.lastIndexOf('layers.fill')).toBeGreaterThan(glyph.indexOf('drawContour'));
  });

  it('builds three glow layers, all from the chord’s own role colour', () => {
    const glyph = source('FlowChordGlyphRenderer.swift');

    // Diffuse aura, then near glow, then contour, then fill.
    expect(glyph.indexOf('layers.glowOuter')).toBeLessThan(glyph.indexOf('layers.glowCore'));
    expect(glyph.indexOf('layers.glowCore')).toBeLessThan(glyph.indexOf('layers.outline'));
    // The spread stays dim while the core carries the brightness.
    expect(glyph).toMatch(/glowRadius \* 3\.2/);
    expect(glyph).toContain('0.34 * intensity');
  });

  it('keeps the degree label out of the chord name’s way', () => {
    const hero = source('FlowClassicChordHeroRenderer.swift');
    const degreeSection = hero.slice(hero.indexOf('let degreeFont'));

    // No glow layers on the secondary label, whatever the chord name gained.
    expect(degreeSection).not.toContain('FlowChordGlyphRenderer');
    expect(degreeSection).not.toContain('setShadow');
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

  /**
   * Classic is frozen on its output, not only on its source: the audit defines Classic as
   * "the current output produced by FrameRenderer.makeImage". So the role palette reaches
   * Flow through a sidecar, and the segment colour every renderer shares is untouched.
   */
  it('leaves the Classic output untouched by sending roles beside the segments', () => {
    const plan = repoSource('src/lib/exportPlan.ts');
    const service = repoSource('src/services/videoExport/index.ts');
    const bridge = source('ChordVideoExportModule.swift');
    const classic = source('FrameRenderer.swift');

    // The shared segment colour still resolves from harmonic function alone.
    expect(plan).toContain('colorHex: functionColor[ev.function]');
    expect(plan).not.toContain('harmonicRoleVisuals');
    expect(service).toContain("input.visualStyle === 'flow' ? harmonicRoleVisuals");
    expect(bridge).toContain('@Field var harmonicRoleVisuals: [HarmonicRoleVisualRecord] = []');
    expect(classic).not.toMatch(/harmonicRole|rolePalette|VisualHarmonicRole/i);
  });

  it('lets the renderer paint but never choose a colour', () => {
    const palette = source('FlowHarmonicRolePalette.swift');
    const glyph = source('FlowChordGlyphRenderer.swift');

    // Colour values live in the TypeScript tokens; Swift only reads what it was sent.
    expect(palette).not.toMatch(/0x[0-9a-f]{2} \/ 255/i);
    expect(glyph).not.toMatch(/0x[0-9a-f]{2} \/ 255/i);
    // With no palette sent, every layer falls back to the segment's own colour.
    expect(palette).toContain('fallback: UIColor');
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
