import { MAJOR_DIATONIC_TENSIONS, NATURAL_MINOR_TENSIONS } from '@/lib/musicTheory';
import { CHORD_CATALOG, getDefinitionById } from '@/lib/theory/definitions';

import { chordCatalogTensionProvider } from '../providers/chordCatalogTensionProvider';
import { availableTensionRule } from '../rules/availableTensionRule';
import { ALL_L2_TONAL_CONTEXTS, l2Context, seventhChord } from '../testing/l2Progressions';
import { triadChord } from '../testing/phase1Progressions';
import type { EvolutionChord } from '../types';

const dependencies = {
  theory: {} as never,
  tension: chordCatalogTensionProvider,
};

function resolutions(
  tonic: Parameters<typeof seventhChord>[0],
  mode: Parameters<typeof seventhChord>[1],
  degree: number,
) {
  const chord = seventhChord(tonic, mode, degree);
  return chordCatalogTensionProvider.resolveAvailableTensions({ tonic, mode }, chord);
}

describe('availableTensionRule', () => {
  it('evaluates all 12 keys and 7 degrees in major and natural minor', () => {
    for (const { tonic, mode } of ALL_L2_TONAL_CONTEXTS) {
      for (let degree = 0; degree < 7; degree += 1) {
        expect(() => resolutions(tonic, mode, degree)).not.toThrow();
      }
    }
  });

  it('uses only the explicit available set and excludes every explicit avoid token', () => {
    for (const mode of ['major', 'minor'] as const) {
      const table = mode === 'major' ? MAJOR_DIATONIC_TENSIONS : NATURAL_MINOR_TENSIONS;
      for (let degree = 0; degree < 7; degree += 1) {
        const available = new Set(table[degree]!.available);
        const avoid = new Set(table[degree]!.avoid);
        for (const resolution of resolutions('C', mode, degree)) {
          expect(resolution.addedTensions.length).toBeGreaterThan(0);
          expect(
            resolution.addedTensions.every(
              (tension) => available.has(tension) && !avoid.has(tension),
            ),
          ).toBe(true);
        }
      }
    }
  });

  it('honors the hard gate for major ii and natural-minor iv 13ths', () => {
    expect(
      resolutions('C', 'major', 1).some((resolution) => resolution.addedTensions.includes('13')),
    ).toBe(false);
    expect(
      resolutions('A', 'minor', 3).some((resolution) => resolution.addedTensions.includes('13')),
    ).toBe(false);
  });

  it('fails closed for existing tensions, triads, sus, diminished, augmented, and non-diatonic chords', () => {
    const base = seventhChord('C', 'major', 0);
    const invalid: EvolutionChord[] = [
      { ...base, symbol: { rootOffset: 0, suffix: 'maj9', definitionId: 'maj9' } },
      triadChord('C', 'major', 0),
      { ...base, symbol: { rootOffset: 0, suffix: 'sus4', definitionId: 'sus4' } },
      { ...base, symbol: { rootOffset: 0, suffix: 'dim', definitionId: 'dim' } },
      { ...base, symbol: { rootOffset: 0, suffix: 'aug', definitionId: 'aug' } },
      { ...base, symbol: { rootOffset: 1, suffix: 'maj7', definitionId: 'maj7' } },
    ];
    for (const chord of invalid) {
      expect(
        chordCatalogTensionProvider.resolveAvailableTensions({ tonic: 'C', mode: 'major' }, chord),
      ).toEqual([]);
    }
  });

  it('fails closed when the definition id and suffix disagree', () => {
    const chord: EvolutionChord = {
      ...seventhChord('C', 'major', 0),
      symbol: {
        rootOffset: 0,
        suffix: 'maj7',
        definitionId: 'm7',
      },
    };
    expect(
      chordCatalogTensionProvider.resolveAvailableTensions({ tonic: 'C', mode: 'major' }, chord),
    ).toEqual([]);
  });

  it('emits only internally consistent CHORD_CATALOG targets', () => {
    for (const { tonic, mode } of ALL_L2_TONAL_CONTEXTS) {
      for (let degree = 0; degree < 7; degree += 1) {
        for (const resolution of resolutions(tonic, mode, degree)) {
          const definition = getDefinitionById(resolution.targetSymbol.definitionId);
          expect(definition).toBeDefined();
          expect(CHORD_CATALOG).toContain(definition);
          expect(definition).toMatchObject({
            symbol: resolution.targetSymbol.suffix,
            category: 'tension',
          });
        }
      }
    }
  });

  it('requires every added tone in a compound target to be available', () => {
    const compound = resolutions('C', 'major', 0).find(
      (resolution) => resolution.targetSymbol.definitionId === 'maj13',
    );
    expect(compound?.addedTensions).toEqual(['9', '13']);
    expect(
      resolutions('C', 'major', 0).some(
        (resolution) => resolution.targetSymbol.definitionId === 'maj11',
      ),
    ).toBe(false);
  });

  it('preserves root, bass, function, duration, event identity and voicing position', () => {
    const chord: EvolutionChord = {
      ...seventhChord('C', 'major', 0, {
        eventId: 'stable-event',
        durationBeats: 2,
      }),
      symbol: {
        rootOffset: 0,
        suffix: 'maj7',
        definitionId: 'maj7',
        bassOffset: 4,
        rootSpelling: { degreeIndex: 0, alteration: 0 },
      },
      voicingPosition: 'first',
    };
    const context = l2Context([chord], {
      scope: { kind: 'chord', index: 0 },
    });
    const application = availableTensionRule.generate(context, 0, dependencies)[0];
    expect(application?.change.kind === 'replace' ? application.change.after : null).toMatchObject({
      eventId: 'stable-event',
      function: chord.function,
      durationBeats: 2,
      voicingPosition: 'first',
      symbol: {
        rootOffset: 0,
        bassOffset: 4,
        rootSpelling: { degreeIndex: 0, alteration: 0 },
      },
    });
  });

  it('uses explicit local harmonic context without inference', () => {
    const explicit = seventhChord('A', 'minor', 1, {
      localHarmonicContext: {
        kind: 'EXPLICIT_LOCAL',
        tonic: 'A',
        mode: 'minor',
      },
    });
    const withoutLocal: EvolutionChord = {
      ...explicit,
      localHarmonicContext: undefined,
    };
    expect(
      chordCatalogTensionProvider.resolveAvailableTensions({ tonic: 'C', mode: 'major' }, explicit)
        .length,
    ).toBeGreaterThan(0);
    expect(
      chordCatalogTensionProvider.resolveAvailableTensions(
        { tonic: 'C', mode: 'major' },
        withoutLocal,
      ),
    ).toEqual([]);
  });
});
