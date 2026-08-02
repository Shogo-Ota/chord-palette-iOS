import {
  MAJOR_KEYS,
  availableVariations,
  diatonicLibrary,
  noteAt,
  secondaryDominants,
  slashChord,
  variationChord,
} from '@/data/music';
import {
  CHORD_CATALOG,
  getDefinitionBySymbol,
  intervalsForSuffix,
  pitchClassesFromIntervals,
} from '@/lib/music/definitions/catalog';
import { chordMidiNotes } from '@/lib/voicing';
import type { VariationId } from '@/lib/music/variations';

function pcs(notes: number[]): number[] {
  return [...new Set(notes.map((n) => ((n % 12) + 12) % 12))].sort((a, b) => a - b);
}

/** Pitch classes of body notes, expressed relative to the chord root. */
function relativeBodyPcs(midiNotes: number[]): number[] {
  const body = midiNotes.slice(2);
  const rootPc = body[0] % 12;
  return pcs(body.map((n) => n - rootPc));
}

describe('CHORD_CATALOG integrity', () => {
  it('has unique ids and symbols', () => {
    const ids = CHORD_CATALOG.map((d) => d.id);
    const symbols = CHORD_CATALOG.map((d) => d.symbol);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it('requires the Phase-7 fields on every definition', () => {
    for (const d of CHORD_CATALOG) {
      expect(d.symbol).toEqual(expect.any(String));
      expect(d.buttonLabel.length).toBeGreaterThan(0);
      expect(d.quality).toBeTruthy();
      expect(d.intervals.length).toBeGreaterThanOrEqual(3);
      expect(Array.isArray(d.extensions)).toBe(true);
      expect(Array.isArray(d.alterations)).toBe(true);
      expect(d.category).toBeTruthy();
      expect(typeof d.priority).toBe('number');
      expect(Array.isArray(d.tags)).toBe(true);
    }
  });
});

describe('display / intervals / MIDI consistency across 12 keys', () => {
  const samples: { suffix: string; rootOffset: number }[] = [
    { suffix: '', rootOffset: 0 },
    { suffix: 'maj7', rootOffset: 0 },
    { suffix: 'm7', rootOffset: 2 },
    { suffix: '7', rootOffset: 7 },
    { suffix: 'maj9(#11)', rootOffset: 0 },
    { suffix: '6/9', rootOffset: 0 },
    { suffix: 'm6/9', rootOffset: 2 },
    { suffix: '7alt', rootOffset: 7 },
    { suffix: 'm7♭5(9)', rootOffset: 11 },
    { suffix: '13(#11)', rootOffset: 7 },
  ];

  it('matches catalog pitch classes for every major key', () => {
    for (const key of MAJOR_KEYS) {
      for (const { suffix, rootOffset } of samples) {
        const def = getDefinitionBySymbol(suffix);
        expect(def).toBeDefined();
        const expectedPcs = pitchClassesFromIntervals(def!.intervals);
        const midi = chordMidiNotes({ rootOffset, suffix }, key);
        expect(relativeBodyPcs(midi)).toEqual(expectedPcs);
        expect(`${noteAt(key, rootOffset)}${suffix}`).toBe(
          `${noteAt(key, rootOffset)}${def!.symbol}`,
        );
      }
    }
  });

  it('covers every catalog symbol × 12 keys via definitionId', () => {
    for (const key of MAJOR_KEYS) {
      for (const def of CHORD_CATALOG) {
        const midiById = chordMidiNotes(
          { rootOffset: 0, suffix: def.symbol, definitionId: def.id },
          key,
        );
        const midiBySuffix = chordMidiNotes({ rootOffset: 0, suffix: def.symbol }, key);
        expect(relativeBodyPcs(midiById)).toEqual(pitchClassesFromIntervals(def.intervals));
        expect(midiById).toEqual(midiBySuffix);
      }
    }
  });
});

describe('definitionId library wiring', () => {
  it('attaches catalog ids on diatonic / variation / secondary / slash', () => {
    const dia = diatonicLibrary('C')[0];
    expect(dia.definitionId).toBe(getDefinitionBySymbol(dia.suffix)?.id);

    const v = variationChord('C', 0, 'maj11');
    expect(v.definitionId).toBe(getDefinitionBySymbol('maj11')?.id);

    const sec = secondaryDominants('C')[0];
    expect(sec.definitionId).toBe(getDefinitionBySymbol('7')?.id);

    const slash = slashChord('C', dia, 'E');
    expect(slash.definitionId).toBe(dia.definitionId);
  });
});

describe('Phase 5 tension catalog (no avoid-note gating)', () => {
  it('offers maj11 / 6/9 / altered / vii° tensions', () => {
    expect(availableVariations(0)).toEqual(
      expect.arrayContaining(['maj11', 'sixNine', 'maj9sharp11', 'maj13sharp11', '9', '13']),
    );
    expect(availableVariations(4)).toEqual(
      expect.arrayContaining(['11', 'b9', 'sharp9', 'alt', 'thirteen_sharp11']),
    );
    expect(availableVariations(6)).toEqual(['m7b5_9', 'm7b5_11', 'm7b5_b13', 'dim7_add9']);
  });

  it('keeps minor quality on iii / vi additions', () => {
    expect(variationChord('C', 2, '9').displayName).toBe('Em9');
    expect(variationChord('C', 2, 'nine_11').displayName).toBe('Em9(11)');
    expect(variationChord('C', 5, 'sixNine').displayName).toBe('Am6/9');
    expect(variationChord('C', 5, '13').displayName).toBe('Am13');
  });

  it('builds Phase-5 display names on I and V', () => {
    expect(variationChord('C', 0, 'maj11').displayName).toBe('Cmaj11');
    expect(variationChord('C', 0, 'sixNine').displayName).toBe('C6/9');
    expect(variationChord('C', 0, 'maj9sharp11').displayName).toBe('Cmaj9(#11)');
    expect(variationChord('C', 4, 'alt').displayName).toBe('G7alt');
    expect(variationChord('C', 4, 'b9').displayName).toBe('G7(♭9)');
  });

  it('aligns variation suffix intervals with MIDI body pcs', () => {
    const cases: { degree: number; id: VariationId }[] = [
      { degree: 0, id: 'maj13sharp11' },
      { degree: 1, id: 'm13_9_11' },
      { degree: 4, id: 'alt' },
      { degree: 6, id: 'dim7_add9' },
    ];
    for (const { degree, id } of cases) {
      const chord = variationChord('C', degree, id);
      const expected = pitchClassesFromIntervals(intervalsForSuffix(chord.suffix));
      expect(relativeBodyPcs(chordMidiNotes(chord, 'C'))).toEqual(expected);
      expect(chord.displayName.endsWith(chord.suffix)).toBe(true);
    }
  });
});
