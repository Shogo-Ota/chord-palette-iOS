import {
  chromaticMediantChords,
  passingDiminishedChords,
  substituteChords,
} from '@/data/advancedHarmonyChords';
import { MAJOR_KEYS, keyTonicPc } from '@/data/music';
import { intervalsForChord } from '@/lib/theory/definitions';

function wrap(value: number): number {
  return ((value % 12) + 12) % 12;
}

describe('advanced harmony chord palettes', () => {
  it('builds the approved C-major passing diminished shortlist', () => {
    const chords = passingDiminishedChords('C');

    expect(chords.map((chord) => chord.degreeLabel)).toEqual(['#I°7', '♭III°7', '#IV°7', '#V°7']);
    expect(chords.map((chord) => chord.displayName)).toEqual([
      'C#dim7',
      'E♭dim7',
      'F#dim7',
      'G#dim7',
    ]);
    expect(chords.map((chord) => chord.subLabel)).toEqual(['→Dm7', '→Dm7', '→G7', '→Am7']);
    expect(chords.every((chord) => chord.badgeLabel === 'DIM')).toBe(true);
  });

  it('builds the C-major tritone substitute and backdoor cards', () => {
    const chords = substituteChords('C', 'major');

    expect(chords.map((chord) => chord.displayName)).toEqual(['D♭7', 'B♭7']);
    expect(chords.map((chord) => chord.degreeLabel)).toEqual(['SubV7', '♭VII7']);
    expect(chords.map((chord) => chord.subLabel)).toEqual(['→Cmaj7', '→Cmaj7']);
    expect(chords.map((chord) => chord.commonName)).toEqual(['裏コード', 'バックドア']);
  });

  it('builds the approved C-major chromatic mediants without false resolution arrows', () => {
    const chords = chromaticMediantChords('C');

    expect(chords.map((chord) => chord.displayName)).toEqual([
      'E♭maj7',
      'Emaj7',
      'A♭maj7',
      'Amaj7',
    ]);
    expect(chords.map((chord) => chord.degreeLabel)).toEqual([
      '♭IIImaj7',
      'IIImaj7',
      '♭VImaj7',
      'VImaj7',
    ]);
    expect(chords.every((chord) => chord.subLabel == null)).toBe(true);
    expect(chords.every((chord) => chord.badgeLabel === 'COLOR')).toBe(true);
  });

  it('keeps minor conservative and exposes only SubV7 resolving to i', () => {
    expect(substituteChords('C', 'minor')).toEqual([
      expect.objectContaining({
        displayName: 'D♭7',
        degreeLabel: 'SubV7',
        subLabel: '→Cm',
        commonName: '裏コード',
      }),
    ]);
  });

  it('resolves every card from relative offsets and production definitions in all keys', () => {
    for (const key of MAJOR_KEYS) {
      const cards = [
        ...passingDiminishedChords(key),
        ...substituteChords(key, 'major'),
        ...substituteChords(key, 'minor'),
        ...chromaticMediantChords(key),
      ];

      for (const chord of cards) {
        expect(chord.displayName).not.toContain('undefined');
        expect(chord.definitionId).toEqual(expect.any(String));
        expect(intervalsForChord(chord.suffix, chord.definitionId).length).toBeGreaterThanOrEqual(
          4,
        );
        expect(wrap(keyTonicPc(key) + chord.rootOffset)).toBeGreaterThanOrEqual(0);
        expect(chord.isPro).toBe(true);
      }
    }
  });

  it('uses degree-aware spelling instead of a key-wide sharp or flat preference', () => {
    expect(passingDiminishedChords('G').map((chord) => chord.displayName)).toEqual([
      'G#dim7',
      'B♭dim7',
      'C#dim7',
      'D#dim7',
    ]);
    expect(substituteChords('G', 'major').map((chord) => chord.displayName)).toEqual(['A♭7', 'F7']);
  });
});
