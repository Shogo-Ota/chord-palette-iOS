import { diatonicLibrary, secondaryDominants, slashChord, variationChord } from '@/data/music';
import { PRESETS } from '@/data/presets';
import { buildPresetProgression } from '@/lib/presets';
import { transposeEvent, transposeProgression } from '@/lib/transpose';
import type { ChordEvent, MajorKey } from '@/types';

function preset(id: string) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`missing preset ${id}`);
  return p;
}

function toEvents(presetId: string, key: MajorKey): ChordEvent[] {
  return buildPresetProgression(preset(presetId), key).map((e, i) => ({ ...e, id: `e-${i}` }));
}

describe('transposeProgression (requirements §5.2)', () => {
  it('transposes the royal progression C → G (I V vi IV)', () => {
    const inC = toEvents('jpop-royal', 'C');
    expect(inC.map((e) => e.displayName)).toEqual(['C', 'G', 'Am', 'F']);
    const inG = transposeProgression(inC, 'G');
    expect(inG.map((e) => e.displayName)).toEqual(['G', 'D', 'Em', 'C']);
  });

  it('preserves degree labels and functions across transposition', () => {
    const inC = toEvents('komuro', 'C');
    const inA = transposeProgression(inC, 'A');
    expect(inA.map((e) => e.degreeLabel)).toEqual(inC.map((e) => e.degreeLabel));
    expect(inA.map((e) => e.function)).toEqual(inC.map((e) => e.function));
    expect(inA.map((e) => e.displayName)).toEqual(['F#m', 'D', 'E', 'A']);
  });

  it('transposes seventh-chord presets (City Pop) with suffixes intact', () => {
    const inC = toEvents('city-pop', 'C');
    const inF = transposeProgression(inC, 'F');
    expect(inF.map((e) => e.displayName)).toEqual(['B♭maj7', 'C7', 'Am7', 'Dm7']);
  });

  it('is idempotent when the key is unchanged', () => {
    const inC = toEvents('jpop-royal', 'C');
    expect(transposeProgression(inC, 'C').map((e) => e.displayName)).toEqual([
      'C',
      'G',
      'Am',
      'F',
    ]);
  });
});

describe('transposeEvent — library-built chords', () => {
  function eventFromLibrary(chord: {
    displayName: string;
    degreeLabel: string;
    function: ChordEvent['function'];
    rootOffset: number;
    suffix: string;
    bassOffset?: number;
    bassNote?: string;
  }): ChordEvent {
    return {
      id: 'x',
      chordId: 'x',
      displayName: chord.displayName,
      degreeLabel: chord.degreeLabel,
      function: chord.function,
      durationBeats: 4,
      isPro: true,
      rootOffset: chord.rootOffset,
      suffix: chord.suffix,
      bassOffset: chord.bassOffset,
      bassNote: chord.bassNote,
    };
  }

  it('transposes a secondary dominant (V7/ii): C=A7 → G=E7', () => {
    const v7ii = secondaryDominants('C').find((c) => c.degreeLabel === 'V7/ii')!;
    expect(v7ii.displayName).toBe('A7');
    const moved = transposeEvent(eventFromLibrary(v7ii), 'G');
    expect(moved.displayName).toBe('E7');
    expect(moved.degreeLabel).toBe('V7/ii');
  });

  it('transposes a variation chord (I sus4): C=Csus4 → D=Dsus4', () => {
    const sus4 = variationChord('C', 0, 'sus4');
    const moved = transposeEvent(eventFromLibrary(sus4), 'D');
    expect(moved.displayName).toBe('Dsus4');
  });

  it('transposes a slash chord and respells its bass: C/E → G becomes G/B', () => {
    const cOverE = slashChord('C', diatonicLibrary('C')[0], 'E'); // C/E
    expect(cOverE.displayName).toBe('C/E');
    const moved = transposeEvent(eventFromLibrary(cOverE), 'G');
    expect(moved.displayName).toBe('G/B');
    expect(moved.bassNote).toBe('B');
    expect(moved.degreeLabel).toBe('I/B');
  });

  it('leaves legacy events without degree data unchanged', () => {
    const legacy = {
      id: 'l',
      chordId: 'C',
      displayName: 'C',
      degreeLabel: 'I',
      function: 'tonic',
      durationBeats: 4,
      isPro: false,
    } as unknown as ChordEvent;
    expect(transposeEvent(legacy, 'G').displayName).toBe('C');
  });
});
