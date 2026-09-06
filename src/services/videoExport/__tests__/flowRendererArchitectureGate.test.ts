import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const IOS = path.join(ROOT, 'modules/chord-video-export/ios');

function source(file: string): string {
  return fs.readFileSync(path.join(IOS, file), 'utf8').replace(/\r\n/g, '\n');
}

describe('Phase V4 Flow renderer architecture', () => {
  it('dispatches Flow without changing the shared writer or frozen renderers', () => {
    const registry = source('VideoFrameRendererRegistry.swift');

    expect(registry).toMatch(/case \.flow:\s+return FlowFrameRenderer\(\)/);
    expect(registry).toMatch(/case \.pulse:\s+return PulseFrameRenderer\(\)/);
    expect(registry).toMatch(/case \.classic:\s+return ClassicFrameRendererAdapter\(\)/);
  });

  it('keeps Flow additive and independent from Classic and Pulse rendering', () => {
    const renderer = source('FlowFrameRenderer.swift');
    const stage = source('FlowHarmonicStageRenderer.swift');

    expect(renderer).toContain('struct FlowFrameRenderer: VideoFrameRendering');
    expect(renderer).toContain('FlowFrameStateResolver.resolve');
    expect(renderer).toContain('FlowHarmonicStageRenderer.draw');
    expect(`${renderer}\n${stage}`).not.toContain('FrameRenderer.makeImage');
    expect(`${renderer}\n${stage}`).not.toContain('PulseFrameRenderer');
    expect(`${renderer}\n${stage}`).not.toContain('PulseFrameState');
    expect(renderer.split('\n').length).toBeLessThan(500);
  });

  it('derives musical state only from segment boundaries and array order', () => {
    const state = source('FlowFrameState.swift');

    expect(state).toContain('currentSegment.startSec');
    expect(state).toContain('currentSegment.durationSec');
    expect(state).toContain('currentCycleIndex + 1');
    expect(state).toContain('cycleSegments.count');
    expect(state).not.toMatch(/\.bpm\b|beatsPerBar|frameIndex|audioURL|AVAudio|60(?:\.0)?\s*\//);
  });

  it('uses one centralized handoff target and smoothstep without bounce', () => {
    const state = source('FlowFrameState.swift');

    expect(state).toContain('static let handoffStartNormalized: CGFloat = 0.70');
    expect(state.match(/handoffStartNormalized/g)).toHaveLength(3);
    expect(state).toContain('return x * x * (3 - 2 * x)');
    expect(state).not.toMatch(/spring|bounce|overshoot/i);
  });

  it('renders a stronger cubic light path and exactly one moving radial glow', () => {
    const renderer = source('FlowFrameRenderer.swift');
    const stage = source('FlowHarmonicStageRenderer.swift');
    const keyboard = source('FlowKeyboardRenderer.swift');
    const branding = source('FlowBrandRenderer.swift');
    const flowSources = `${renderer}\n${stage}\n${keyboard}\n${branding}`;

    expect(stage).toContain('fullPath.addCurve');
    expect(stage).toContain('cg.setLineWidth(max(3, height * 0.0022))');
    expect(stage).toContain('cg.setLineWidth(max(5, height * 0.0026))');
    expect(flowSources.match(/drawRadialGradient/g)).toHaveLength(1);
    expect(flowSources).not.toMatch(/waveform|particle|CIFilter|Gaussian|blur/i);
    expect(flowSources).not.toContain('drawProgressTrace');
  });

  it('uses the fixed Flow palette without harmonic-function colors', () => {
    const renderer = source('FlowFrameRenderer.swift');
    const stage = source('FlowHarmonicStageRenderer.swift');
    const flowSources = `${renderer}\n${stage}`;

    expect(stage).toContain('paletteGreen');
    expect(stage).toContain('coolBlue');
    expect(flowSources).not.toMatch(/segment\.color|functionColor|keyTint|random/i);
  });

  it('makes NOW and NEXT explicit with approved visual strength', () => {
    const state = source('FlowFrameState.swift');
    const stage = source('FlowHarmonicStageRenderer.swift');

    expect(stage).toContain('role: "NOW"');
    expect(stage).toContain('role: "NEXT"');
    expect(stage).toContain('height * 0.115 * scale');
    expect(stage).toContain('drawSequenceRail');
    expect(state).toContain('static let peakGlowIntensity: CGFloat = 0.30');
    expect(state).toContain('static let stableNextOpacity: CGFloat = 0.68');
  });

  it('keeps keyboard note mapping and uses measured non-ellipsis chord text', () => {
    const renderer = source('FlowFrameRenderer.swift');
    const stage = source('FlowHarmonicStageRenderer.swift');
    const keyboard = source('FlowKeyboardRenderer.swift');

    expect(renderer).toContain('FlowKeyboardRenderer.draw');
    expect(keyboard).toContain('KeyboardLayout.layout');
    expect(keyboard).toContain('KeyboardLayout.highlighted');
    expect(keyboard).toContain('currentSegment.midiNotes');
    expect(stage).toContain('maxWidth / measuredWidth');
    expect(stage).toContain('lineBreakMode = .byClipping');
    expect(`${renderer}\n${stage}`).not.toContain('byTruncatingTail');
  });

  it('uses only the approved icon and does not construct a pseudo wordmark', () => {
    const branding = source('FlowBrandRenderer.swift');

    expect(branding).toContain('path(forResource: "cp-watermark", ofType: "png")');
    expect(branding).not.toContain('"Chord Palette"');
    expect(branding).not.toMatch(/tagline|PLAY MORE COLORS|drawWordmark/i);
  });
});
