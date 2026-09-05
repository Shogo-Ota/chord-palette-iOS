import fs from 'node:fs';
import path from 'node:path';

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sourceFiles(fullPath);
    }
    return entry.name.endsWith('.ts') ? [fullPath] : [];
  });
}

describe('evolution architecture gate', () => {
  const evolutionRoot = path.resolve(__dirname, '..');
  const sources = sourceFiles(evolutionRoot).map((filePath) => ({
    filePath,
    contents: fs.readFileSync(filePath, 'utf8'),
  }));

  it('has no React Native or Expo dependency', () => {
    for (const source of sources) {
      expect(source.contents).not.toMatch(/from ['"](?:react-native|expo(?:-|\/|['"]))/);
    }
  });

  it('has no RevenueCat, service or feature-layer dependency', () => {
    for (const source of sources) {
      expect(source.contents).not.toMatch(
        /RevenueCat|react-native-purchases|@\/services\/|@\/features\/|@\/app\//,
      );
    }
  });

  it('does not import the production performance, energy, style or voicing layers', () => {
    for (const source of sources) {
      expect(source.contents).not.toMatch(
        /@\/lib\/performance\/|\/energy\/|\/styles\/|\/voicing\//,
      );
    }
  });

  it('does not use randomness or wall-clock time', () => {
    for (const source of sources) {
      expect(source.contents).not.toMatch(/Math\.random|Date\.now|new Date\s*\(/);
    }
  });
});
