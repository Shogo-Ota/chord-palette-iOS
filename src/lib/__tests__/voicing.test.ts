import { diatonicSevenths } from '@/data/music';
import { chordMidiNotes, progressionToChordSpecs } from '@/lib/voicing';
import type { ChordEvent, MajorKey } from '@/types';

function ev(
  partial: Partial<ChordEvent> & Pick<ChordEvent, 'rootOffset' | 'suffix'>,
): ChordEvent {
  return {
    id: 'x',
    chordId: 'x',
    displayName: 'x',
    degreeLabel: 'I',
    function: 'tonic',
    durationBeats: 4,
    isPro: false,
    ...partial,
  } as ChordEvent;
}

describe('chordMidiNotes — quality voicings', () => {
  it('C major triad in C = C1 C2 bass + C3 E3 G3 body', () => {
    expect(chordMidiNotes({ rootOffset: 0, suffix: '' }, 'C')).toEqual([24, 36, 48, 52, 55]);
  });

  it('minor triad lowers the third by a semitone', () => {
    expect(chordMidiNotes({ rootOffset: 0, suffix: 'm' }, 'C')).toEqual([24, 36, 48, 51, 55]);
  });

  it('Cmaj7 adds the major seventh', () => {
    expect(chordMidiNotes({ rootOffset: 0, suffix: 'maj7' }, 'C')).toEqual([24, 36, 48, 52, 55, 59]);
  });

  it('dominant 7th (G7 = V in C) roots on G3 with G1/G2 bass', () => {
    // V is 7 semitones above the tonic → bass G1/G2 = 31/43, body root G3 = 55.
    expect(chordMidiNotes({ rootOffset: 7, suffix: '7' }, 'C')).toEqual([31, 43, 55, 59, 62, 65]);
  });

  it('slash chord anchors the bass octaves on the slash note (C/E)', () => {
    const notes = chordMidiNotes({ rootOffset: 0, suffix: '', bassOffset: 4 }, 'C');
    expect(notes.slice(0, 2)).toEqual([28, 40]); // E1/E2 bass = 24+4, 36+4
    expect(notes.slice(2)).toEqual([48, 52, 55]);
  });

  it('unknown suffix falls back to a major triad', () => {
    expect(chordMidiNotes({ rootOffset: 0, suffix: 'weird' as string }, 'C')).toEqual([
      24, 36, 48, 52, 55,
    ]);
  });
});

describe('chordMidiNotes — transposition follows the key', () => {
  it('the tonic triad body root tracks the key tonic pitch class', () => {
    const keys: [MajorKey, number][] = [
      ['C', 48],
      ['D', 50],
      ['F', 53],
      ['G', 55],
      ['A', 57],
      ['B', 59],
    ];
    for (const [key, root] of keys) {
      // Body root is the first note in the C3 band (bass octaves come first).
      const bodyRoot = chordMidiNotes({ rootOffset: 0, suffix: '' }, key).find((n) => n >= 48);
      expect(bodyRoot).toBe(root);
    }
  });

  it('diatonic V7 root is a perfect fifth above the tonic in every key', () => {
    for (const key of ['C', 'E♭', 'G', 'A'] as MajorKey[]) {
      const tonic = chordMidiNotes({ rootOffset: 0, suffix: '' }, key).find((n) => n >= 48)!;
      const dominant = chordMidiNotes({ rootOffset: 7, suffix: '7' }, key).find((n) => n >= 48)!;
      // Roots wrap within one octave band, so compare pitch classes.
      expect((dominant - tonic + 12) % 12).toBe(7);
    }
  });
});

describe('progressionToChordSpecs', () => {
  it('maps each event to notes + its beat length (voice-led body, anchored bass)', () => {
    const prog = [
      ev({ rootOffset: 0, suffix: 'maj7', durationBeats: 4 }),
      ev({ rootOffset: 7, suffix: '7', durationBeats: 2 }),
    ];
    const specs = progressionToChordSpecs(prog, 'C');
    // First chord keeps its root position (nothing precedes it): C1/C2 bass +
    // Cmaj7 body [C3 E3 G3 B3]. Second chord (G7) is voice-led against Cmaj7: the
    // bass stays on G (G1/G2 = 31/43) but the body inverts to [D3 F3 G3 B3] so the
    // common tones G3(55)/B3(59) are held and only C→D, E→F move a step — instead
    // of the old root-position [55,59,62,65] where the top jumped G3→D4→F4.
    expect(specs).toEqual([
      { midiNotes: [24, 36, 48, 52, 55, 59], lengthBeats: 4 },
      { midiNotes: [31, 43, 50, 53, 55, 59], lengthBeats: 2 },
    ]);
  });

  it('covers every diatonic seventh quality without throwing', () => {
    const sevs = diatonicSevenths('C');
    for (const c of sevs) {
      const notes = chordMidiNotes({ rootOffset: c.rootOffset, suffix: c.suffix }, 'C');
      expect(notes.length).toBeGreaterThanOrEqual(3);
    }
  });
});
