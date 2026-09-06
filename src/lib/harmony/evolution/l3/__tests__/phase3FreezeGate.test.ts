import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../../../..');

const PHASE_3_FROZEN_FILES = {
  'src/lib/harmony/evolution/providers/chordCatalogTensionProvider.ts':
    '042a0f735201ca231dfb771ff2f60712d8c26ad198154b7f9103b97a0baba879',
  'src/lib/harmony/evolution/providers/chordToneSlashProvider.ts':
    '67e153573e90bae967e9c726bf86f945336019522b06f6c3104c0583ae4435a8',
  'src/lib/harmony/evolution/rules/availableTensionRule.ts':
    '3978caecb6c15af45f2bc775a7286f12187bd920b92cc1cd618e055b3dcd24d9',
  'src/lib/harmony/evolution/rules/smoothSlashChordRule.ts':
    '7cfa20c0a85544c9a62508bea8fa5d477192f41ce87bd329cdf4cb28863b6252',
  'src/lib/harmony/evolution/recipes/l2Recipe.ts':
    '81da1772defc3376815959f20283aa4e25c090e6a92fcf6cd45ef1c308fddc1c',
  'src/features/editor/chordEvolution/candidateShapePolicy.ts':
    '11be7d02acb77da9ac45d71eb958c754ffbdc7b3a62985ff3a3d5b56714fa6b4',
  'src/features/editor/chordEvolution/chordEventAdapter.ts':
    'd06f6aebeadade5a633243f0c642fff1115ecbe7e15d867e296503a21366a35c',
} as const;

function normalizedSha256(relativePath: string): string {
  const source = fs
    .readFileSync(path.join(REPOSITORY_ROOT, relativePath), 'utf8')
    .replace(/\r\n/g, '\n');
  return createHash('sha256').update(source).digest('hex');
}

describe('Phase 3 freeze gate', () => {
  it.each(Object.entries(PHASE_3_FROZEN_FILES))(
    'keeps %s byte-for-byte stable after newline normalization',
    (relativePath, expectedHash) => {
      expect(normalizedSha256(relativePath)).toBe(expectedHash);
    },
  );
});
