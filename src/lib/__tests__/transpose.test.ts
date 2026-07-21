import { diatonicLibrary, secondaryDominants, slashChord, variationChord } from '@/data/music';
import { buildPresetProgression } from '@/lib/presets';
import { SAMPLE_PRESETS } from '@/lib/testFixtures/samplePresets';
import { rebaseProgression, transposeEvent, transposeProgression } from '@/lib/transpose';
import { chordMidiNotes } from '@/lib/voicing';
import type { ChordEvent, MajorKey } from '@/types';

function preset(id: string) {
  const p = SAMPLE_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`missing preset ${id}`);
  return p;
}

function toEvents(presetId: string, key: MajorKey): ChordEvent[] {
  return buildPresetProgression(preset(presetId), key).map((e, i) => ({ ...e, id: `e-${i}` }));
}

describe('rebaseProgression (key change WITHOUT moving chords)', () => {
  it('keeps displayed chord names when the reference key changes', () => {
    const inC = toEvents('jpop-royal', 'C'); // F G Em Am (王道進行 4536)
    const rebased = rebaseProgression(inC, 'C', 'D');
    expect(rebased.map((e) => e.displayName)).toEqual(['F', 'G', 'Em', 'Am']);
  });

  it('preserves absolute pitch (voicing is identical before/after)', () => {
    const inC = toEvents('city-pop', 'C');
    const rebased = rebaseProgression(inC, 'C', 'A♭');
    for (let i = 0; i < inC.length; i++) {
      expect(chordMidiNotes(rebased[i], 'A♭')).toEqual(chordMidiNotes(inC[i], 'C'));
    }
  });

  it('is the inverse of itself (round-trips back to the original offsets)', () => {
    const inC = toEvents('komuro', 'C');
    const round = rebaseProgression(rebaseProgression(inC, 'C', 'F'), 'F', 'C');
    expect(round.map((e) => e.rootOffset)).toEqual(inC.map((e) => e.rootOffset));
  });
});

describe('transposeProgression (requirements §5.2)', () => {
  it('transposes the royal progression C → G (IV V iii vi)', () => {
    const inC = toEvents('jpop-royal', 'C');
    expect(inC.map((e) => e.displayName)).toEqual(['F', 'G', 'Em', 'Am']);
    const inG = transposeProgression(inC, 'G');
    expect(inG.map((e) => e.displayName)).toEqual(['C', 'D', 'Bm', 'Em']);
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
      'F',
      'G',
      'Em',
      'Am',
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
    // The bass denominator is a DEGREE (key-invariant), not a note name.
    expect(cOverE.degreeLabel).toBe('I/III');
    const moved = transposeEvent(eventFromLibrary(cOverE), 'G');
    expect(moved.displayName).toBe('G/B'); // name respelled for the new key
    expect(moved.bassNote).toBe('B');
    expect(moved.degreeLabel).toBe('I/III'); // degree stays the same across keys
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
