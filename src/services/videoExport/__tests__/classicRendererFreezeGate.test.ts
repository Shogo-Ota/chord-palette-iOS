import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../..');

const CLASSIC_RENDERER_PATH = 'modules/chord-video-export/ios/FrameRenderer.swift';
const VIDEO_WRITER_PATH = 'modules/chord-video-export/ios/VideoWriter.swift';
const CLASSIC_RENDERER_SHA256 = 'feeeaba31983d4921955d41c0392c670503285626d37d6a7c5df8d2df42c854c';
const VIDEO_WRITER_V1_SHA256 = '57e824c7c2b1989901ac07271ceb882585bcbf6701e8642b1b3afa3b12bf018e';

function normalizedSource(relativePath: string): string {
  return fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function sha256(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

function canonicalVideoWriterSource(): string {
  return normalizedSource(VIDEO_WRITER_PATH)
    .replace('\n    frameRenderer: any VideoFrameRendering,', '')
    .replace(
      'frameRenderer.makeImage(plan: plan, timeSec: t)',
      'FrameRenderer.makeImage(plan: plan, timeSec: t)',
    );
}

describe('Classic renderer freeze gate', () => {
  it('keeps FrameRenderer.swift byte-for-byte stable after newline normalization', () => {
    expect(sha256(normalizedSource(CLASSIC_RENDERER_PATH))).toBe(CLASSIC_RENDERER_SHA256);
  });

  it('keeps the V1 writer stable outside the approved V3 strategy seam', () => {
    expect(sha256(canonicalVideoWriterSource())).toBe(VIDEO_WRITER_V1_SHA256);
  });

  it('keeps the Swift default and routes style only through the renderer registry', () => {
    const bridge = fs.readFileSync(
      path.join(REPOSITORY_ROOT, 'modules/chord-video-export/ios/ChordVideoExportModule.swift'),
      'utf8',
    );
    expect(bridge).toContain('@Field var visualStyle: String = "classic"');
    expect(bridge).toContain('VideoFrameRendererRegistry.renderer(for: planRecord.visualStyle)');
    expect(bridge).not.toMatch(/FrameRenderer\..*visualStyle|VideoWriter\..*visualStyle/);
  });
});
