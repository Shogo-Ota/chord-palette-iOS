import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(__dirname, '../../../..');
const IOS = path.join(ROOT, 'modules/chord-video-export/ios');

function source(file: string): string {
  return fs.readFileSync(path.join(IOS, file), 'utf8').replace(/\r\n/g, '\n');
}

describe('Pulse renderer architecture gate', () => {
  it('keeps the retired Pulse sources frozen', () => {
    expect(createHash('sha256').update(source('PulseFrameRenderer.swift')).digest('hex')).toBe(
      'e33231555b532b35d1c14c8a3add2d8983cf935b6cb3fa3eda743973e73f4885',
    );
    expect(createHash('sha256').update(source('PulseFrameState.swift')).digest('hex')).toBe(
      '10c7dcb206f3c9a72e2d4710feff09a34cff5e3230244986555ca3e19296120b',
    );
  });

  it('makes Pulse unreachable and normalizes its legacy value to Classic', () => {
    const registry = source('VideoFrameRendererRegistry.swift');

    expect(registry).toContain('NativeVideoVisualStyle(rawValue: value) ?? .classic');
    expect(registry).not.toContain('case pulse');
    expect(registry).not.toContain('case .pulse');
    expect(registry).not.toContain('PulseFrameRenderer()');
    expect(registry).toMatch(/case \.flow:\s+return FlowFrameRenderer\(timeline: flowTimeline, rolePalette: flowRolePalette\)/);
    expect(registry).toMatch(/case \.classic:\s+return ClassicFrameRendererAdapter\(\)/);
  });

  it('resolves the renderer once at the bridge and injects it into the shared writer', () => {
    const bridge = source('ChordVideoExportModule.swift');
    const writer = source('VideoWriter.swift');

    expect(bridge).toContain('let frameRenderer = VideoFrameRendererRegistry.renderer(');
    expect(bridge).toContain('for: planRecord.visualStyle,');
    expect(bridge).toContain('frameRenderer: frameRenderer');
    expect(writer).toContain('frameRenderer: any VideoFrameRendering');
    expect(writer).toContain('frameRenderer.makeImage(plan: plan, timeSec: t)');
    expect(writer.match(/frameRenderer\.makeImage/g)).toHaveLength(1);
  });
});
