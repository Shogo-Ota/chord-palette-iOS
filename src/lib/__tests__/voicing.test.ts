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
  it('C major triad in C = C3 E3 G3 (48,52,55)', () => {
    expect(chordMidiNotes({ rootOffset: 0, suffix: '' }, 'C')).toEqual([48, 52, 55]);
  });

  it('minor triad lowers the third by a semitone', () => {
    expect(chordMidiNotes({ rootOffset: 0, suffix: 'm' }, 'C')).toEqual([48, 51, 55]);
  });

  it('Cmaj7 adds the major seventh', () => {
    expect(chordMidiNotes({ rootOffset: 0, suffix: 'maj7' }, 'C')).toEqual([48, 52, 55, 59]);
  });

  it('dominant 7th (G7 = V in C) roots on G3', () => {
    // V is 7 semitones above the tonic → G3 = 55.
    expect(chordMidiNotes({ rootOffset: 7, suffix: '7' }, 'C')).toEqual([55, 59, 62, 65]);
  });

  it('slash chord prepends the bass an octave below (C/E)', () => {
    const notes = chordMidiNotes({ rootOffset: 0, suffix: '', bassOffset: 4 }, 'C');
    expect(notes[0]).toBe(40); // E2 bass = 36 + 4
    expect(notes.slice(1)).toEqual([48, 52, 55]);
  });

  it('unknown suffix falls back to a major triad', () => {
    expect(chordMidiNotes({ rootOffset: 0, suffix: 'weird' as string }, 'C')).toEqual([48, 52, 55]);
  });
});

describe('chordMidiNotes — transposition follows the key', () => {
  it('the tonic triad tracks the key tonic pitch class', () => {
    const keys: [MajorKey, number][] = [
      ['C', 48],
      ['D', 50],
      ['F', 53],
      ['G', 55],
      ['A', 57],
      ['B', 59],
    ];
    for (const [key, root] of keys) {
      expect(chordMidiNotes({ rootOffset: 0, suffix: '' }, key)[0]).toBe(root);
    }
  });

  it('diatonic V7 root is a perfect fifth above the tonic in every key', () => {
    for (const key of ['C', 'E♭', 'G', 'A'] as MajorKey[]) {
      const tonic = chordMidiNotes({ rootOffset: 0, suffix: '' }, key)[0];
      const dominant = chordMidiNotes({ rootOffset: 7, suffix: '7' }, key)[0];
      // Roots wrap within one octave band, so compare pitch classes.
      expect((dominant - tonic + 12) % 12).toBe(7);
    }
  });
});

describe('progressionToChordSpecs', () => {
  it('maps each event to notes + its beat length', () => {
    const prog = [
      ev({ rootOffset: 0, suffix: 'maj7', durationBeats: 4 }),
      ev({ rootOffset: 7, suffix: '7', durationBeats: 2 }),
    ];
    const specs = progressionToChordSpecs(prog, 'C');
    expect(specs).toEqual([
      { midiNotes: [48, 52, 55, 59], lengthBeats: 4 },
      { midiNotes: [55, 59, 62, 65], lengthBeats: 2 },
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
