/**
 * Guards on the shipped icon artwork.
 *
 * These are the two ways the icons have actually gone wrong: an alpha channel in
 * the App Store icon, which App Store Connect rejects on upload after the build
 * has already been paid for, and an opaque square where a pre-rounded icon sits on
 * a coloured background, which is what put a white frame around the in-app mark.
 *
 * Reads the PNG header directly rather than pulling in an image library — IHDR is
 * at a fixed offset and carries everything being asserted.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../../..');

/** PNG colour types that carry an alpha channel. */
const WITH_ALPHA = new Set([4, 6]);

type Header = { width: number; height: number; colorType: number };

function header(relPath: string): Header {
  const buf = readFileSync(join(ROOT, relPath));
  // 8-byte signature, then the IHDR chunk: 4 length + 4 type + width, height, depth, colour.
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf.readUInt8(25),
  };
}

describe('the App Store icon', () => {
  // Apple rejects an icon with transparency, and does so at upload rather than at
  // build time — the cheapest place to catch it is here.
  it.each(['assets/icon/app-icon.png', 'assets/icon/app-store-icon-1024.png'])(
    '%s is 1024 square and fully opaque',
    (path) => {
      const h = header(path);
      expect(h).toMatchObject({ width: 1024, height: 1024 });
      expect(WITH_ALPHA.has(h.colorType)).toBe(false);
    },
  );
});

describe('the pre-rounded marks', () => {
  // These are drawn over the paywall gradient and the app background. Without an
  // alpha channel their corners are squares of whatever the artwork's backdrop was,
  // which is exactly the white frame that shipped once already.
  it.each(['assets/icon/icon.png', 'assets/icon/app-icon-pro.png'])(
    '%s carries its own corners',
    (path) => {
      const h = header(path);
      expect(WITH_ALPHA.has(h.colorType)).toBe(true);
      expect(h.width).toBe(h.height);
    },
  );
});

describe('the video watermark', () => {
  it('sits where FrameRenderer looks for it', () => {
    // FrameRenderer.swift does Bundle.main.path(forResource: "cp-watermark", ...).
    // A rename here is silent: the export just draws no mark.
    const swift = readFileSync(
      join(ROOT, 'modules/chord-video-export/ios/FrameRenderer.swift'),
      'utf8',
    );
    const named = /forResource:\s*"([^"]+)"/.exec(swift)?.[1];
    expect(named).toBe('cp-watermark');
    expect(() => header(`modules/chord-video-export/ios/assets/${named}.png`)).not.toThrow();
  });
});
