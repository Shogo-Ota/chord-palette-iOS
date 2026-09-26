import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const IOS = path.join(ROOT, 'modules/chord-video-export/ios');

function source(file: string): string {
  return fs.readFileSync(path.join(IOS, file), 'utf8').replace(/\r\n/g, '\n');
}

describe('Phase V4 Flow performance-motion architecture', () => {
  it('adds the sidecar only to Flow so the Classic payload stays unchanged', () => {
    const service = fs
      .readFileSync(path.join(ROOT, 'src/services/videoExport/index.ts'), 'utf8')
      .replace(/\r\n/g, '\n');

    expect(service).toContain("input.visualStyle === 'flow'");
    expect(service).toContain('buildVisualNoteTimeline(performance, durationSec)');
    expect(service).toContain(
      'const plan = visualNoteEvents ? { ...basePlan, visualNoteEvents } : basePlan;',
    );
  });

  it('injects the optional sidecar only into Flow without changing writer/protocol', () => {
    const bridge = source('ChordVideoExportModule.swift');
    const registry = source('VideoFrameRendererRegistry.swift');
    const protocol = source('VideoFrameRendering.swift');
    const writer = source('VideoWriter.swift');

    expect(bridge).toContain('@Field var visualNoteEvents: [VisualNoteEventRecord] = []');
    expect(bridge).toContain('@Field var harmonicRoleVisuals: [HarmonicRoleVisualRecord] = []');
    expect(bridge).toContain('FlowVisualNoteTimeline(');
    expect(registry).toContain('flowTimeline: FlowVisualNoteTimeline = .empty');
    expect(registry).toMatch(
      /case \.flow:\s+return FlowFrameRenderer\(timeline: flowTimeline, rolePalette: flowRolePalette\)/,
    );
    expect(registry).not.toContain('PulseFrameRenderer()');
    expect(registry).toMatch(/case \.classic:\s+return ClassicFrameRendererAdapter\(\)/);
    expect(protocol).toContain('func makeImage(plan: RenderPlan, timeSec: Double)');
    expect(writer).not.toContain('FlowVisualNote');
  });

  it('keeps chord timing and note timing in separate resolvers', () => {
    const chordState = source('FlowFrameState.swift');
    const timeline = source('FlowVisualNoteTimeline.swift');
    const motionState = source('FlowFallingBlockState.swift');

    expect(chordState).toContain('currentSegment.startSec');
    expect(chordState).not.toMatch(/FlowVisualNote|fallLeadSec|landing/);
    expect(timeline).toContain('FlowVisualNoteEvent');
    expect(timeline).not.toMatch(/RenderSegment|chordsPerCycle|currentSegment/);
    expect(motionState).toContain('event.startSec - frameTimeSec');
    expect(motionState).not.toMatch(/RenderSegment|segmentProgress|\.bpm\b|60(?:\.0)?\s*\//);
  });

  it('renders rounded performance blocks and note-driven keyboard landings', () => {
    const renderer = source('FlowFrameRenderer.swift');
    const blocks = source('FlowFallingBlockRenderer.swift');
    const keyboard = source('FlowKeyboardRenderer.swift');
    const flowSources = `${renderer}\n${blocks}\n${keyboard}`;

    expect(renderer).toContain('final class FlowFrameRenderer: VideoFrameRendering');
    expect(renderer).toContain('timeline.visibleEvents');
    expect(renderer).toContain('FlowFallingBlockRenderer.draw');
    expect(renderer).toContain('FlowKeyboardRenderer.draw');
    expect(blocks).toContain('KeyboardLayout.fold');
    expect(blocks).toContain('UIBezierPath(roundedRect:');
    expect(keyboard).toContain('FlowFallingBlockStateResolver.landingIntensity');
    expect(keyboard).not.toMatch(/currentSegment|midiNotes|KeyboardLayout\.highlighted/);
    expect(flowSources).not.toMatch(
      /waveform|particle|CIFilter|Gaussian|blur|game score|combo|judgement|random/i,
    );
  });

  it('limits per-frame work to a binary-bounded visibility window', () => {
    const timeline = source('FlowVisualNoteTimeline.swift');
    const state = source('FlowFallingBlockState.swift');
    const renderer = source('FlowFrameRenderer.swift');

    expect(state).toContain('static let fallLeadSec = 1.25');
    expect(timeline).toContain('lowerBound(for:');
    expect(timeline).toContain('upperBound(for:');
    expect(timeline).toContain('events[lower..<upper].filter');
    expect(renderer).toContain('cachedKeys');
    expect(`${timeline}\n${renderer}`).not.toMatch(/CIFilter|Gaussian|blur/i);
  });

  it('draws falling notes behind a Classic-style chord hierarchy and thin rail', () => {
    const renderer = source('FlowFrameRenderer.swift');
    const stage = source('FlowClassicChordStageRenderer.swift');
    const hero = source('FlowClassicChordHeroRenderer.swift');

    expect(stage).toContain('FlowClassicChordHeroRenderer.draw');
    expect(hero).toContain('segment.displayName');
    expect(hero).toContain('height * 0.085, weight: .black');
    expect(hero).toContain('segment.degreeLabel');
    expect(stage).toContain('state.cycleSegments.enumerated()');
    expect(stage).not.toContain('"NEXT"');
    expect(renderer.indexOf('FlowFallingBlockRenderer.draw')).toBeLessThan(
      renderer.indexOf('FlowClassicChordStageRenderer.draw'),
    );
  });

  it('uses segment function colors without changing visual-note timing', () => {
    const stage = source('FlowClassicChordStageRenderer.swift');
    const hero = source('FlowClassicChordHeroRenderer.swift');
    const renderer = source('FlowFrameRenderer.swift');
    const colors = source('FlowVisualColorResolver.swift');
    const blocks = source('FlowFallingBlockRenderer.swift');
    const keyboard = source('FlowKeyboardRenderer.swift');
    const glyph = source('FlowChordGlyphRenderer.swift');
    const flowSources = `${stage}\n${hero}\n${renderer}\n${colors}\n${blocks}\n${keyboard}\n${glyph}`;

    // Colour still comes from the plan, never invented by a renderer. A role palette may
    // refine it, and with none sent every layer falls back to the segment's own colour.
    // A diatonic chord takes the segment colour and Flow's original single-shadow text.
    expect(hero).toContain('drawLegacyChordName');
    expect(hero).toContain('color: segment.color');
    expect(stage).toContain('?? segment.color');
    // Notes and keys stay on the segment colour whatever the chord's role is.
    expect(keyboard).not.toContain('roleColors');
    expect(blocks).not.toContain('roleColors');
    expect(colors).toContain('while lower < upper');
    expect(colors).toContain('return segment.color');
    expect(blocks).toContain('FlowVisualColorResolver.color');
    expect(keyboard).not.toContain('FlowVisualColorResolver.color');
    expect(keyboard).toContain('fallbackColor.withAlphaComponent');
    expect(renderer).toContain('fallbackColor: current.color');
    expect(colors).not.toMatch(/bpm|beat|durationSec\s*=|startSec\s*=/i);
    expect(flowSources).not.toMatch(/CIFilter|Gaussian|particle|random/i);
  });

  it('colors a note by the chord it voices, resolved once in the domain', () => {
    const timeline = fs
      .readFileSync(path.join(ROOT, 'src/services/videoExport/visualNoteTimeline.ts'), 'utf8')
      .replace(/\r\n/g, '\n');
    const bridge = source('ChordVideoExportModule.swift');
    const colors = source('FlowVisualColorResolver.swift');
    const renderer = source('FlowFrameRenderer.swift');

    expect(timeline).toContain("import { chordIndexForNote } from '@/lib/performance/harmonyGate'");
    expect(timeline).toContain('chord.startBeat * secondsPerBeat');
    expect(bridge).toContain('@Field var harmonyStartSec: Double = -1');
    expect(bridge).toContain('harmonyStartSec: $0.harmonyStartSec');
    expect(colors).toContain('event.harmonyStartSec >= 0 ? event.harmonyStartSec : event.startSec');
    // The style name is carried by the export UI, never printed over the render.
    expect(renderer).not.toContain('FLOW');
  });

  it('matches the accepted Classic center font, pulse, transition and bloom constants', () => {
    const classic = source('FrameRenderer.swift');
    const hero = source('FlowClassicChordHeroRenderer.swift');

    for (const contract of [
      '60.0 /',
      'exp(-beatPhase * 3.2)',
      'min(0.16,',
      '* 0.45',
      '* 0.085, weight: .black',
      '* 0.30 + slide',
      '1.0 + 0.045 * pulse * ease',
      '* 0.02 * (0.5 + pulse)',
      '* 0.030, weight: .bold',
      '* 0.40 + slide * 0.5',
    ]) {
      expect(classic).toContain(contract);
      expect(hero).toContain(contract);
    }
    // The hero still owns the background bloom; the light on the letters moved to the
    // glyph renderer when the outline became a silhouette rather than a glyph stroke.
    expect(hero).toContain('cg.drawRadialGradient');
    expect(source('FlowChordGlyphRenderer.swift')).toContain('cg.setShadow');
  });

  it('uses the approved icon and product-name horizontal lockup', () => {
    const branding = source('FlowBrandRenderer.swift');

    expect(branding).toContain('path(forResource: "cp-watermark", ofType: "png")');
    expect(branding).toContain('FlowBrandWordmarkRenderer.size(fontSize: fontSize)');
    expect(branding).toContain('let totalWidth = iconWidth + textSize.width');
    expect(branding).toContain('left: startX + iconWidth');
    expect(branding).not.toMatch(/tagline|PLAY MORE COLORS/i);
  });

  it('paints the Flow wordmark with the same rainbow lockup as Classic', () => {
    const classic = source('FrameRenderer.swift');
    const wordmark = source('FlowBrandWordmarkRenderer.swift');
    const tokens = fs
      .readFileSync(path.join(ROOT, 'src/theme/tokens.ts'), 'utf8')
      .replace(/\r\n/g, '\n');

    for (const contract of [
      '"Chord "',
      '"Palette"',
      'NotoSansJP-ExtraBold',
      'setTextDrawingMode(.clip)',
      'CTLineDraw(line, cg)',
      '0.012',
    ]) {
      expect(classic).toContain(contract);
      expect(wordmark).toContain(contract);
    }
    // Both renderers restate theme token `rainbow`; drift here would split the brand.
    const rainbowChannels = [
      '0xef',
      '0x44',
      '0xf9',
      '0x73',
      '0xea',
      '0xb3',
      '0x22',
      '0xc5',
      '0x3b',
      '0x82',
      '0x8b',
      '0x5c',
    ];
    for (const channel of rainbowChannels) {
      expect(wordmark).toContain(channel);
    }
    expect(tokens).toContain(
      "export const rainbow = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6']",
    );
  });

  it('spells harmonic roles on the rail instead of repeating chord names', () => {
    const stage = source('FlowClassicChordStageRenderer.swift');
    const hero = source('FlowClassicChordHeroRenderer.swift');

    // Chord name stays the hero; the rail carries position plus nearby degrees only.
    expect(hero).toContain('segment.displayName');
    expect(stage).not.toContain('segment.displayName');
    expect(stage).toContain('segment.degreeLabel');
    expect(stage).toContain('private static let labelledNeighbours = 2');
    expect(stage).toContain('let forward = ((index - currentIndex) % count + count) % count');
    expect(stage).toContain('min(forward, count - forward) <= Self.labelledNeighbours');
  });

  it('keeps each Flow rendering responsibility below the God-file limit', () => {
    for (const file of [
      'FlowFrameRenderer.swift',
      'FlowBrandRenderer.swift',
      'FlowBrandWordmarkRenderer.swift',
      'FlowClassicChordStageRenderer.swift',
      'FlowClassicChordHeroRenderer.swift',
      'FlowFallingBlockRenderer.swift',
      'FlowFallingBlockState.swift',
      'FlowKeyboardRenderer.swift',
      'FlowVisualColorResolver.swift',
      'FlowVisualNoteTimeline.swift',
      'FlowRoleAuraRenderer.swift',
      'FlowRoleEmphasis.swift',
      'FlowHarmonicRolePalette.swift',
      'FlowChordGlyphRenderer.swift',
    ]) {
      expect(source(file).split('\n').length).toBeLessThan(500);
    }
  });
});
