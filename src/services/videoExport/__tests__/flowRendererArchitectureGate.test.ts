import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const IOS = path.join(ROOT, 'modules/chord-video-export/ios');

function source(file: string): string {
  return fs.readFileSync(path.join(IOS, file), 'utf8').replace(/\r\n/g, '\n');
}

describe('Phase V4 Flow performance-motion architecture', () => {
  it('adds the sidecar only to Flow so Classic/Pulse payloads stay unchanged', () => {
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
    expect(registry).toMatch(/case \.pulse:\s+return PulseFrameRenderer\(\)/);
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

  it('keeps NOW dominant, hides one-chord NEXT and uses a thin full-cycle rail', () => {
    const state = source('FlowFrameState.swift');
    const stage = source('FlowHarmonicStageRenderer.swift');

    expect(stage).toContain('role: "NOW"');
    expect(stage).toContain('nameSize: height * 0.105');
    expect(stage).toContain('role: "NEXT"');
    expect(stage).toContain('nameSize: height * 0.056');
    expect(stage).toContain('opacity: 0.68');
    expect(stage).toContain('state.cycleSegments.enumerated()');
    expect(state).toContain('let hasNext = cycleSegments.count > 1');
    expect(state).toContain('nextSegment: hasNext ? cycleSegments[nextIndex] : nil');
  });

  it('removes the superseded motion-line and moving-glow direction', () => {
    const stage = source('FlowHarmonicStageRenderer.swift');
    const renderer = source('FlowFrameRenderer.swift');
    const flowSources = `${stage}\n${renderer}`;

    expect(flowSources).not.toMatch(
      /drawMotionPath|drawMovingGlow|FlowStageCurve|partialPath|cubicPoint|drawRadialGradient/,
    );
    expect(flowSources).not.toMatch(/segment\.color|functionColor|keyTint|drawProgressTrace/);
  });

  it('uses only the approved official icon without pseudo branding', () => {
    const branding = source('FlowBrandRenderer.swift');

    expect(branding).toContain('path(forResource: "cp-watermark", ofType: "png")');
    expect(branding).not.toContain('"Chord Palette"');
    expect(branding).not.toMatch(/tagline|PLAY MORE COLORS|drawWordmark/i);
  });

  it('keeps each Flow rendering responsibility below the God-file limit', () => {
    for (const file of [
      'FlowFrameRenderer.swift',
      'FlowHarmonicStageRenderer.swift',
      'FlowFallingBlockRenderer.swift',
      'FlowFallingBlockState.swift',
      'FlowKeyboardRenderer.swift',
      'FlowVisualNoteTimeline.swift',
    ]) {
      expect(source(file).split('\n').length).toBeLessThan(500);
    }
  });
});
