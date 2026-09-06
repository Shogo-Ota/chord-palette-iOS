import fs from 'node:fs';
import path from 'node:path';

import {
  L2_EVOLUTION_RECIPE_POLICY,
  SAFE_AVAILABLE_TENSION_EVOLUTION_POLICY,
  SAFE_SLASH_EVOLUTION_POLICY,
} from '@/lib/musicTheory';

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
}

describe('L2 evolution architecture gate', () => {
  it('keeps Theory DB tables and App Policy provenance explicitly separate', () => {
    for (const policy of [
      SAFE_AVAILABLE_TENSION_EVOLUTION_POLICY,
      SAFE_SLASH_EVOLUTION_POLICY,
      L2_EVOLUTION_RECIPE_POLICY,
    ]) {
      expect(policy.source.kind).toBe('APP_POLICY_PROPOSED');
    }
    expect(read('providers/chordCatalogTensionProvider.ts')).toContain('MAJOR_DIATONIC_TENSIONS');
    expect(read('providers/chordCatalogTensionProvider.ts')).toContain('NATURAL_MINOR_TENSIONS');
    expect(read('providers/chordCatalogTensionProvider.ts')).toContain('CHORD_CATALOG');
  });

  it('does not claim measured evidence or introduce a second evolution framework', () => {
    for (const relativePath of [
      'providers/chordCatalogTensionProvider.ts',
      'providers/chordToneSlashProvider.ts',
      'rules/availableTensionRule.ts',
      'rules/smoothSlashChordRule.ts',
      'recipes/l2Recipe.ts',
    ]) {
      const source = read(relativePath);
      expect(source).not.toContain("evidence: 'MEASURED'");
      expect(source).not.toMatch(
        /PerformanceEngine|EnergyProfile|RevenueCat|Math\.random|Date\.now/,
      );
    }
  });

  it('uses existing Rule, Provider and Recipe ports', () => {
    expect(read('rules/availableTensionRule.ts')).toContain('EvolutionRule');
    expect(read('rules/smoothSlashChordRule.ts')).toContain('EvolutionRule');
    expect(read('recipes/l2Recipe.ts')).toContain('EvolutionRecipe');
    expect(read('generateCandidates.ts')).toContain('EvolutionRuleDependencies');
  });
});
