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

describe('Chord Evolution Phase 2 architecture gate', () => {
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

  it('keeps repositories, billing and analytics out of the Feature boundary', () => {
    for (const source of featureSources) {
      expect(source.contents).not.toMatch(
        /@\/repositories\/|@\/services\/billing|@\/services\/analytics/,
      );
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

  it('defines the flag as off without exposing it in Editor UI', () => {
    expect(featureFlags.chordEvolution).toBe(false);
    const editorUi = fs.readFileSync(path.resolve(__dirname, '../../../../app/editor.tsx'), 'utf8');
    expect(editorUi).not.toContain('chordEvolution');
  });
});
