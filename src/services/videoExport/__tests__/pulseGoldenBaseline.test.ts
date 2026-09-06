import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');

const PULSE_GOLDENS = {
  'docs/acceptance/phase-v3-pulse-golden-frame-000.png':
    '3a6adb1f600e114b4fe60aada038e7d0bdf651eab2d9b8686ec410fa65fd9ad1',
  'docs/acceptance/phase-v3-pulse-golden-frame-015.png':
    '783ce449ef7561fa972c0bcc837862e2e9e39b7a768fd22c8b57cb1541015837',
  'docs/acceptance/phase-v3-pulse-golden-frame-056.png':
    'cd8f4b584b26f9eecb2c6f4ee154fb7f13d7a36bfd512d46ec40a91b46293a10',
  'docs/acceptance/phase-v3-pulse-golden-frame-111.png':
    '8030f75621d90da63f392b8cfe469872dfd8c1c895209438b2ee118d576ec08a',
  'docs/acceptance/phase-v3-pulse-golden-frame-167.png':
    'cb62044b024e885c3fa82c2bfbb1365308eefebd391423e49b78eee0470c6bef',
  'docs/acceptance/phase-v3-pulse-golden-frame-221.png':
    'd58362db1992ba6653d70b405594cc326ca8b1b79a8f8dc9ec1434d106edaa1f',
} as const;

describe('Phase V3 Pulse PNG Golden baseline', () => {
  it.each(Object.entries(PULSE_GOLDENS))(
    'keeps %s byte-for-byte stable',
    (relativePath, expectedHash) => {
      const png = fs.readFileSync(path.join(ROOT, relativePath));
      expect(createHash('sha256').update(png).digest('hex')).toBe(expectedHash);
      expect(png.readUInt32BE(16)).toBe(720);
      expect(png.readUInt32BE(20)).toBe(1280);
    },
  );
});
