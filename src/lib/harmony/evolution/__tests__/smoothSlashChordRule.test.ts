import { keyTonicPc } from '@/data/music';
import { getDefinitionById } from '@/lib/theory/definitions';

import { generateEvolutionCandidates } from '../generateCandidates';
import { chordToneSlashProvider } from '../providers/chordToneSlashProvider';
import { smoothSlashChordRule } from '../rules/smoothSlashChordRule';
import { l2Context, seventhChord, seventhProgression } from '../testing/l2Progressions';
import type { EvolutionChord } from '../types';

const dependencies = {
  theory: {} as never,
  slash: chordToneSlashProvider,
};

function distance(left: number, right: number): number {
  const pitchClassDistance = Math.abs((left % 12) - (right % 12));
  return Math.min(pitchClassDistance, 12 - pitchClassDistance);
}

describe('smoothSlashChordRule', () => {
  it('emits only third/fifth chord-tone basses and excludes root and seventh bass', () => {
    const progression = seventhProgression('C', 'major', [0, 3, 4]);
    const context = l2Context(progression);
    for (let index = 0; index < progression.length; index += 1) {
      const source = progression[index]!;
      const definition = getDefinitionById(source.symbol.definitionId!);
      const sourcePitchClasses = new Set(definition!.intervals.map((interval) => interval % 12));
      const resolutions = chordToneSlashProvider.resolveChordToneBassOptions(context, index);
      for (const resolution of resolutions) {
        const relativeBass = (resolution.bassOffset - source.symbol.rootOffset + 12) % 12;
        expect(sourcePitchClasses.has(relativeBass)).toBe(true);
        expect(['3', 'b3', '5', 'b5']).toContain(resolution.bassDegree);
        expect(relativeBass).not.toBe(0);
        expect(relativeBass).not.toBe(10);
        expect(relativeBass).not.toBe(11);
      }
    }
  });

  it('requires strict total movement improvement without maximum-leap regression', () => {
    const progression = seventhProgression('C', 'major', [0, 3, 4]);
    const context = l2Context(progression);
    const target = progression[1]!;
    const previousBass = keyTonicPc('C') + progression[0]!.symbol.rootOffset;
    const nextBass = keyTonicPc('C') + progression[2]!.symbol.rootOffset;
    const rootBass = keyTonicPc('C') + target.symbol.rootOffset;
    const baselineLeaps = [distance(previousBass, rootBass), distance(rootBass, nextBass)];
    for (const resolution of chordToneSlashProvider.resolveChordToneBassOptions(context, 1)) {
      expect(resolution.totalMovement).toBeLessThan(baselineLeaps[0]! + baselineLeaps[1]!);
      expect(resolution.maximumLeap).toBeLessThanOrEqual(Math.max(...baselineLeaps));
      expect(resolution.improvement).toBeGreaterThan(0);
    }
  });

  it('changes bassOffset and slash chordId only', () => {
    const progression = seventhProgression('C', 'major', [0, 3, 4]);
    const context = l2Context(progression);
    const applications = smoothSlashChordRule.generate(context, 1, dependencies);
    expect(applications.length).toBeGreaterThan(0);
    for (const application of applications) {
      expect(application.change.kind).toBe('replace');
      if (application.change.kind !== 'replace') continue;
      const { before, after } = application.change;
      expect(after.eventId).toBe(before.eventId);
      expect(after.function).toBe(before.function);
      expect(after.durationBeats).toBe(before.durationBeats);
      expect(after.voicingPosition).toBe(before.voicingPosition);
      expect(after.symbol.rootOffset).toBe(before.symbol.rootOffset);
      expect(after.symbol.suffix).toBe(before.symbol.suffix);
      expect(after.symbol.definitionId).toBe(before.symbol.definitionId);
      expect(after.symbol.bassOffset).not.toBe(before.symbol.bassOffset);
      expect(after.chordId).not.toBe(before.chordId);
    }
  });

  it('fails closed for existing slash, non-diatonic, non-seventh, and definition mismatch', () => {
    const valid = seventhProgression('C', 'major', [0, 3, 4]);
    const invalidTargets: EvolutionChord[] = [
      {
        ...valid[1]!,
        symbol: { ...valid[1]!.symbol, bassOffset: 9 },
      },
      {
        ...valid[1]!,
        symbol: { rootOffset: 1, suffix: 'maj7', definitionId: 'maj7' },
      },
      {
        ...valid[1]!,
        symbol: { rootOffset: 5, suffix: '', definitionId: 'major' },
      },
      {
        ...valid[1]!,
        symbol: { rootOffset: 5, suffix: 'maj7', definitionId: 'm7' },
      },
    ];
    for (const target of invalidTargets) {
      const context = l2Context([valid[0]!, target, valid[2]!]);
      expect(chordToneSlashProvider.resolveChordToneBassOptions(context, 1)).toEqual([]);
    }
  });

  it('returns zero with no adjacent context or when motion cannot improve', () => {
    expect(
      chordToneSlashProvider.resolveChordToneBassOptions(
        l2Context([seventhChord('C', 'major', 0)]),
        0,
      ),
    ).toEqual([]);
    const repeated = seventhProgression('C', 'major', [0, 0, 0]);
    expect(chordToneSlashProvider.resolveChordToneBassOptions(l2Context(repeated), 1)).toEqual([]);
  });

  it('keeps slash candidate counts at or below three in chord and progression scope', () => {
    const progression = seventhProgression('C', 'major', [0, 3, 4, 0]);
    for (const scope of [{ kind: 'chord', index: 1 } as const, { kind: 'progression' } as const]) {
      expect(
        generateEvolutionCandidates(l2Context(progression, { scope })).length,
      ).toBeLessThanOrEqual(3);
    }
  });

  it('uses deterministic movement rank and prefers third-family on a full tie', () => {
    const context = l2Context(seventhProgression('C', 'major', [0, 3, 4]));
    const options = chordToneSlashProvider.resolveChordToneBassOptions(context, 1);
    expect(options.map((option) => option.totalMovement)).toEqual(
      [...options].map((option) => option.totalMovement).sort((left, right) => left - right),
    );
    expect(new Set(options.map((option) => option.priority)).size).toBe(options.length);
  });
});
