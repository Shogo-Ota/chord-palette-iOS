import fs from 'node:fs';
import path from 'node:path';

import { L3_INSERTION_POLICY, L3_RANKING_POLICY } from '@/lib/musicTheory';

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), 'utf8');
}

function implementationFiles(directory: string): readonly string[] {
  const absolute = path.join(REPOSITORY_ROOT, directory);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : implementationFiles(relative);
    }
    return entry.name.endsWith('.ts') ? [relative] : [];
  });
}

describe('L3 architecture gate', () => {
  it('keeps Domain pure, deterministic and independent of protected systems', () => {
    for (const relativePath of implementationFiles('src/lib/harmony/evolution/l3')) {
      const source = read(relativePath);
      expect(source).not.toMatch(
        /react-native|expo-|RevenueCat|PerformanceEngine|EnergyProfile|Math\.random|Date\.now/,
      );
    }
  });

  it('keeps app policy provenance separate from Theory DB claims', () => {
    expect(L3_INSERTION_POLICY.source.kind).toBe('APP_POLICY_PROPOSED');
    expect(L3_RANKING_POLICY.source.kind).toBe('APP_POLICY_PROPOSED');
    expect(read('src/lib/harmony/evolution/l3/providers/secondaryDominantProvider.ts')).toContain(
      'SECONDARY_DOMINANTS_MAJOR',
    );
    expect(read('src/lib/harmony/evolution/l3/providers/passingDiminishedProvider.ts')).toContain(
      'MAJOR_PASSING_DIMINISHED_PALETTE',
    );
    expect(read('src/lib/harmony/evolution/l3/providers/tritoneSubstitutionProvider.ts')).toContain(
      'SUBSTITUTE_DOMINANT',
    );
  });

  it('delegates only reharm generation and dispatches materialization by level', () => {
    const generator = read('src/lib/harmony/evolution/generateCandidates.ts');
    expect(generator).toContain("context.level === 'reharm'");
    expect(generator).toContain("{ ...context, level: 'tension' }");
    expect(generator).toContain('generateL3Candidates');

    const materializer = read('src/features/editor/chordEvolution/candidateMaterializer.ts');
    expect(materializer).toContain("candidate.level === 'reharm'");
    expect(materializer).toContain('materializeCandidateProgression');
    expect(materializer).toContain('materializeReharmCandidateProgression');
  });

  it('keeps theory decisions out of the presentational component', () => {
    const sheet = read('src/components/cp/CPChordEvolutionSheet.tsx');
    expect(sheet).not.toMatch(
      /SECONDARY_DOMINANTS_MAJOR|MAJOR_PASSING_DIMINISHED_PALETTE|SUBSTITUTE_DOMINANT|CHORD_CATALOG|generateEvolutionCandidates/,
    );
  });
});
