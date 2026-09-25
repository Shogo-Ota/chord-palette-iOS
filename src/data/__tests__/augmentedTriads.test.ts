import { augmentedTriads } from '@/data/augmentedTriads';
import { MAJOR_KEYS, degreeLabelFromOffset, keyTonicPc, noteAt } from '@/data/music';
import { chordPreviewRequest } from '@/features/editor/playback';
import { isLocked, NO_ENTITLEMENTS } from '@/lib/entitlements';
import { intervalsForChord } from '@/lib/theory/definitions';
import { transposeEvent } from '@/lib/transpose';
import type { ChordEvent, KeyMode, LibraryChord } from '@/types';

const MODES: readonly KeyMode[] = ['major', 'minor'];
const PRO_ENTITLEMENTS = { palettePro: true, communityPlus: false };

function eventFrom(chord: LibraryChord, mode: KeyMode): ChordEvent {
  return {
    id: `aug-event-${chord.id}`,
    chordId: chord.id,
    displayName: chord.displayName,
    degreeLabel: chord.degreeLabel,
    function: chord.function,
    durationBeats: 4,
    isPro: chord.isPro ?? false,
    rootOffset: chord.rootOffset,
    suffix: chord.suffix,
    definitionId: chord.definitionId,
    rootSpelling: chord.rootSpelling,
    category: chord.category,
    modeContext: mode,
  };
}

describe('Palette Pro augmented triads', () => {
  it('exposes all 12 augmented roots in all 12 keys and both modes', () => {
    for (const mode of MODES) {
      for (const key of MAJOR_KEYS) {
        const chords = augmentedTriads(key, mode);

        expect(chords).toHaveLength(12);
        for (const [rootOffset, chord] of chords.entries()) {
          expect(chord).toMatchObject({
            displayName: `${noteAt(key, rootOffset, mode)}aug`,
            degreeLabel: `${degreeLabelFromOffset(rootOffset)}aug`,
            function: 'tonic',
            category: 'augmentedTriad',
            badgeLabel: 'AUG',
            isPro: true,
            rootOffset,
            suffix: 'aug',
            definitionId: 'aug',
          });
          expect(intervalsForChord(chord.suffix, chord.definitionId)).toEqual([0, 4, 8]);
        }
      }
    }
  });

  it('is previewable while locked for Free and unlocked for Palette Pro', () => {
    const chord = augmentedTriads('C', 'major')[0]!;

    expect(isLocked(chord.isPro, NO_ENTITLEMENTS)).toBe(true);
    expect(isLocked(chord.isPro, PRO_ENTITLEMENTS)).toBe(false);

    const preview = chordPreviewRequest(eventFrom(chord, 'major'), 'C', 100, 'piano');
    const pitchClasses = preview.midiNotes.map((midi) => ((midi - keyTonicPc('C')) % 12 + 12) % 12);

    expect(new Set(pitchClasses)).toEqual(new Set([0, 4, 8]));
    expect(pitchClasses).toContain(8);
  });

  it('retains canonical aug quality and spelling across transposition', () => {
    for (const source of augmentedTriads('C', 'major').map((chord) => eventFrom(chord, 'major'))) {
      for (const mode of MODES) {
        for (const key of MAJOR_KEYS) {
          expect(transposeEvent(source, key, mode)).toMatchObject({
            displayName: `${noteAt(key, source.rootOffset, mode)}aug`,
            suffix: 'aug',
            definitionId: 'aug',
            category: 'augmentedTriad',
          });
        }
      }
    }
  });

  it('does not expose augmented extensions or alias suffixes', () => {
    for (const mode of MODES) {
      for (const key of MAJOR_KEYS) {
        for (const chord of augmentedTriads(key, mode)) {
          expect(chord.displayName.endsWith('aug')).toBe(true);
          expect(chord.suffix).toBe('aug');
          expect(chord.displayName).not.toMatch(/aug7|\+|#5/);
        }
      }
    }
  });
});
