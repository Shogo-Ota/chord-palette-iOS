import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const IOS = path.join(ROOT, 'modules/chord-video-export/ios');

function source(file: string): string {
  return fs.readFileSync(path.join(IOS, file), 'utf8').replace(/\r\n/g, '\n');
}

describe('Pulse renderer architecture gate', () => {
  it('keeps Classic behind an adapter and does not call it from Pulse', () => {
    const adapter = source('ClassicFrameRendererAdapter.swift');
    const pulse = source('PulseFrameRenderer.swift');

    expect(adapter).toContain('FrameRenderer.makeImage(plan: plan, timeSec: timeSec)');
    expect(pulse).not.toContain('FrameRenderer.makeImage');
    expect(pulse).not.toMatch(/beatDur|beatPhase|60(?:\.0)?\s*\//);
  });

  it('keeps Pulse separate while V4 owns Flow and invalid values stay Classic', () => {
    const registry = source('VideoFrameRendererRegistry.swift');

    expect(registry).toContain('NativeVideoVisualStyle(rawValue: value) ?? .classic');
    expect(registry).toMatch(/case \.pulse:\s+return PulseFrameRenderer\(\)/);
    expect(registry).toMatch(/case \.flow:\s+return FlowFrameRenderer\(\)/);
    expect(registry).toMatch(/case \.classic:\s+return ClassicFrameRendererAdapter\(\)/);
  });

  it('derives Pulse timing only from segment start and duration values', () => {
    const state = source('PulseFrameState.swift');

    expect(state).toContain('activeSegment.startSec');
    expect(state).toContain('activeSegment.durationSec');
    expect(state).toContain('cycleSegments');
    expect(state).not.toMatch(/\.bpm\b|beatsPerBar|60(?:\.0)?\s*\//);
  });

  it('resolves the renderer once at the bridge and injects it into the shared writer', () => {
    const bridge = source('ChordVideoExportModule.swift');
    const writer = source('VideoWriter.swift');

    expect(bridge).toContain(
      'let frameRenderer = VideoFrameRendererRegistry.renderer(for: planRecord.visualStyle)',
    );
    expect(bridge).toContain('frameRenderer: frameRenderer');
    expect(writer).toContain('frameRenderer: any VideoFrameRendering');
    expect(writer).toContain('frameRenderer.makeImage(plan: plan, timeSec: t)');
    expect(writer.match(/frameRenderer\.makeImage/g)).toHaveLength(1);
  });
});
