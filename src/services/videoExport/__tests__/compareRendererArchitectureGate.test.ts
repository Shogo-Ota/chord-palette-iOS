import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const IOS = path.join(ROOT, 'modules/chord-video-export/ios');

function source(file: string): string {
  return fs.readFileSync(path.join(IOS, file), 'utf8').replace(/\r\n/g, '\n');
}

const FROZEN = {
  'FrameRenderer.swift': 'feeeaba31983d4921955d41c0392c670503285626d37d6a7c5df8d2df42c854c',
  'ClassicFrameRendererAdapter.swift':
    'c20af4aa240f676caf184397c377d1aee603bc96669bebda126c9584da9e6154',
  'PulseFrameRenderer.swift': 'e33231555b532b35d1c14c8a3add2d8983cf935b6cb3fa3eda743973e73f4885',
  'PulseFrameState.swift': '10c7dcb206f3c9a72e2d4710feff09a34cff5e3230244986555ca3e19296120b',
  'FlowFrameRenderer.swift': '0dff50bd36424634c393e16c3a3e7e1dbaca320080a01311cd3e6dd013be4c35',
  'VideoWriter.swift': '81b3fbf0def45a534ef2d87921cc5e04a9c9d7572de48190a2b84b04944bb17f',
} as const;

describe('CP-2 Compare renderer architecture', () => {
  it.each(Object.entries(FROZEN))('keeps %s frozen', (file, expected) => {
    const hash = createHash('sha256').update(source(file)).digest('hex');
    expect(hash).toBe(expected);
  });

  it('selects Compare before Standard visual-style strategies', () => {
    const registry = source('VideoFrameRendererRegistry.swift');
    expect(registry).toContain('if templateId == "compare", let compareScene');
    expect(registry).toContain('return CompareFrameRenderer(scene: compareScene)');
    expect(registry).toContain('switch NativeVideoVisualStyle(normalizing: value)');
  });

  it('keeps Compare drawing independent from music generation and infrastructure', () => {
    const compare = [
      'CompareSceneRecord.swift',
      'CompareSceneValidator.swift',
      'CompareFrameState.swift',
      'CompareFrameRenderer.swift',
      'CompareBrandRenderer.swift',
    ]
      .map(source)
      .join('\n');
    expect(compare).not.toMatch(
      /PerformanceEngine|Evolution|RevenueCat|PostHog|MIDI|AVAudio|random|particle|CIFilter|blur/i,
    );
    expect(compare).toContain('cp-watermark');
    expect(compare).toContain('Chord Palette');
  });

  it('requires a valid optional sidecar only for Compare', () => {
    const bridge = source('ChordVideoExportModule.swift');
    expect(bridge).toContain('@Field var templateId: String = "standard"');
    expect(bridge).toContain('@Field var compareScene: CompareSceneRecord? = nil');
    expect(bridge).toContain('CompareSceneValidator.validate(compareScene)');
  });
});
