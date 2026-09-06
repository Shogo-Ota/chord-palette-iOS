import fs from 'node:fs';
import path from 'node:path';

import { featureFlags } from '@/config/featureFlags';

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sourceFiles(fullPath);
    }
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [fullPath] : [];
  });
}

describe('Chord Evolution UI architecture gate', () => {
  const featureRoot = path.resolve(__dirname, '..');
  const domainRoot = path.resolve(__dirname, '../../../../lib/harmony/evolution');
  const featureSources = sourceFiles(featureRoot).map((filePath) => ({
    filePath,
    contents: fs.readFileSync(filePath, 'utf8'),
  }));
  const domainSources = sourceFiles(domainRoot).map((filePath) => ({
    filePath,
    contents: fs.readFileSync(filePath, 'utf8'),
  }));

  it('keeps React Native, Expo and RevenueCat out of both boundaries', () => {
    for (const source of [...featureSources, ...domainSources]) {
      expect(source.contents).not.toMatch(
        /from ['"](?:react-native|expo(?:-|\/|['"]))|RevenueCat|react-native-purchases/,
      );
    }
  });

  it('keeps Editor and application infrastructure out of Harmony Domain', () => {
    for (const source of domainSources) {
      expect(source.contents).not.toMatch(/@\/features\/|@\/app\/|@\/repositories\/|@\/services\//);
    }
  });

  it('keeps repositories and billing providers out of the Feature boundary', () => {
    for (const source of featureSources) {
      expect(source.contents).not.toMatch(
        /@\/repositories\/|@\/services\/billing|RevenueCat|react-native-purchases/,
      );
    }
  });

  it('centralizes the existing Analytics abstraction in one Feature adapter', () => {
    for (const source of featureSources) {
      if (source.filePath.endsWith(`${path.sep}analytics.ts`)) {
        expect(source.contents).toContain('@/services/analytics');
      } else {
        expect(source.contents).not.toContain('@/services/analytics');
      }
    }
  });

  it('reuses the playback adapter without importing Production Engine directly', () => {
    const preview = fs.readFileSync(path.join(featureRoot, 'preview.ts'), 'utf8');
    expect(preview).toContain('sessionToPlaybackRequest');
    expect(preview).not.toMatch(
      /PerformanceEngine|buildSessionPerformancePlan|generatePerformance/,
    );
  });

  it('does not emulate atomic apply through replaceSelected', () => {
    const apply = fs.readFileSync(path.join(featureRoot, 'apply.ts'), 'utf8');
    expect(apply).toContain('replaceProgressionAtomically');
    expect(apply).not.toContain('replaceSelected');
  });

  it('keeps the default flag off and gates both Editor entries', () => {
    expect(featureFlags.chordEvolution).toBe(false);
    const editorUi = fs.readFileSync(path.resolve(__dirname, '../../../../app/editor.tsx'), 'utf8');
    expect(editorUi).toContain("visibleActions.evolutionProgression.state === 'ready'");
    expect(editorUi).toContain('chordContext');
    expect(editorUi).not.toContain('RevenueCat');
  });
});
