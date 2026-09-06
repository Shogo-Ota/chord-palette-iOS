import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');

const FROZEN_SOURCES = {
  'modules/chord-video-export/ios/FrameRenderer.swift':
    'feeeaba31983d4921955d41c0392c670503285626d37d6a7c5df8d2df42c854c',
  'modules/chord-video-export/ios/ClassicFrameRendererAdapter.swift':
    'c20af4aa240f676caf184397c377d1aee603bc96669bebda126c9584da9e6154',
  'modules/chord-video-export/ios/PulseFrameRenderer.swift':
    'e33231555b532b35d1c14c8a3add2d8983cf935b6cb3fa3eda743973e73f4885',
  'modules/chord-video-export/ios/PulseFrameState.swift':
    '10c7dcb206f3c9a72e2d4710feff09a34cff5e3230244986555ca3e19296120b',
  'modules/chord-video-export/ios/VideoWriter.swift':
    '81b3fbf0def45a534ef2d87921cc5e04a9c9d7572de48190a2b84b04944bb17f',
  'src/services/videoExport/videoVisualStyle.ts':
    '0b349621c6a33b5c0b9cfb5dcbfec2034e422c28ef3a78f9460232914e34b760',
  'src/features/videoExport/VideoVisualStyleSelector.tsx':
    '6a2f934ba89760a4f1ab0fc5712d7fdc46cb5a80dd5ef5ec7703c8d53311940e',
} as const;

function normalizedSha256(relativePath: string): string {
  const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');
  return createHash('sha256').update(source).digest('hex');
}

describe('Phase V4 frozen dependencies', () => {
  it.each(Object.entries(FROZEN_SOURCES))('keeps %s unchanged', (relativePath, expectedHash) => {
    expect(normalizedSha256(relativePath)).toBe(expectedHash);
  });

  it('retains every accepted Pulse PNG Golden hash', () => {
    const pulseGoldenTest = fs.readFileSync(
      path.join(ROOT, 'src/services/videoExport/__tests__/pulseGoldenBaseline.test.ts'),
      'utf8',
    );

    expect(pulseGoldenTest.match(/phase-v3-pulse-golden-frame-/g)).toHaveLength(6);
  });
});
