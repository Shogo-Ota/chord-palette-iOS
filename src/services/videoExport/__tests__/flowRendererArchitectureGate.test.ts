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
    expect(bridge).toContain('FlowVisualNoteTimeline(');
    expect(registry).toContain('flowTimeline: FlowVisualNoteTimeline = .empty');
    expect(registry).toMatch(/case \.flow:\s+return FlowFrameRenderer\(timeline: flowTimeline\)/);
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
    const flowSources = `${stage}\n${hero}\n${renderer}\n${colors}\n${blocks}\n${keyboard}`;

    expect(hero).toContain('color: segment.color');
    expect(stage).toContain('segment.color.withAlphaComponent');
    expect(colors).toContain('while lower < upper');
    expect(colors).toContain('return segment.color');
    expect(blocks).toContain('FlowVisualColorResolver.color');
    expect(keyboard).not.toContain('FlowVisualColorResolver.color');
    expect(keyboard).toContain('fallbackColor.withAlphaComponent');
    expect(renderer).toContain('fallbackColor: current.color');
    expect(colors).not.toMatch(/bpm|beat|durationSec\s*=|startSec\s*=/i);
    expect(flowSources).not.toMatch(/CIFilter|Gaussian|particle|random/i);
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
    expect(hero).toContain('cg.drawRadialGradient');
    expect(hero).toContain('cg.setShadow');
  });

  it('uses the approved icon and product-name horizontal lockup', () => {
    const branding = source('FlowBrandRenderer.swift');

    expect(branding).toContain('path(forResource: "cp-watermark", ofType: "png")');
    expect(branding).toContain('private static let productName = "Chord Palette"');
    expect(branding).toContain('let totalWidth = iconWidth + textSize.width');
    expect(branding).toContain('x: startX + iconWidth');
    expect(branding).not.toMatch(/tagline|PLAY MORE COLORS|drawWordmark/i);
  });

  it('keeps each Flow rendering responsibility below the God-file limit', () => {
    for (const file of [
      'FlowFrameRenderer.swift',
      'FlowClassicChordStageRenderer.swift',
      'FlowClassicChordHeroRenderer.swift',
      'FlowFallingBlockRenderer.swift',
      'FlowFallingBlockState.swift',
      'FlowKeyboardRenderer.swift',
      'FlowVisualColorResolver.swift',
      'FlowVisualNoteTimeline.swift',
    ]) {
      expect(source(file).split('\n').length).toBeLessThan(500);
    }
  });
});
