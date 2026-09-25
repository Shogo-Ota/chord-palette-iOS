import { augmentedConnectorCards } from '@/data/augmentedConnectors';
import {
  chromaticMediantChords,
  passingDiminishedChords,
  substituteChords,
} from '@/data/advancedHarmonyChords';
import { MAJOR_KEYS, diatonicLibrary, modalInterchange, secondaryDominants } from '@/data/music';
import {
  isNonDiatonicChord,
  nonDiatonicCycleIndices,
  outsideKeyPitchClasses,
} from '@/lib/videoExport/nonDiatonic';
import type { ChordEvent, KeyMode, LibraryChord, MajorKey } from '@/types';

function event(chord: LibraryChord, mode: KeyMode = 'major'): ChordEvent {
  return {
    id: chord.id,
    displayName: chord.displayName,
    degreeLabel: chord.degreeLabel,
    function: chord.function,
    durationBeats: 4,
    rootOffset: chord.rootOffset,
    suffix: chord.suffix,
    definitionId: chord.definitionId,
    bassOffset: chord.bassOffset,
    modeContext: mode,
  } as unknown as ChordEvent;
}

function named(chords: readonly LibraryChord[], displayName: string): LibraryChord {
  const found = chords.find((chord) => chord.displayName === displayName);
  if (!found) throw new Error(`no chord named ${displayName}`);
  return found;
}

describe('every diatonic chord stays ordinary', () => {
  it('finds nothing outside the key in the diatonic library, in all 12 keys', () => {
    for (const mode of ['major', 'minor'] as const) {
      for (const key of MAJOR_KEYS as readonly MajorKey[]) {
        for (const chord of diatonicLibrary(key, mode)) {
          expect({
            key,
            mode,
            chord: chord.displayName,
            outside: outsideKeyPitchClasses(event(chord, mode)),
          }).toEqual({ key, mode, chord: chord.displayName, outside: [] });
        }
      }
    }
  });
});

describe('every advanced technique reads as special', () => {
  const c = 'C' as MajorKey;

  it.each([
    ['secondary dominant', () => secondaryDominants(c)],
    ['passing diminished', () => passingDiminishedChords(c)],
    ['tritone substitute and backdoor', () => substituteChords(c, 'major')],
    ['chromatic mediant', () => chromaticMediantChords(c)],
    ['augmented connector', () => augmentedConnectorCards(c, 'major')],
    ['modal interchange', () => modalInterchange(c)],
  ])('marks %s as leaving the key', (_label, build) => {
    for (const chord of build()) {
      expect({
        chord: chord.displayName,
        special: isNonDiatonicChord(event(chord)),
      }).toEqual({ chord: chord.displayName, special: true });
    }
  });

  it('names exactly the notes that leave the key', () => {
    // E7 in C brings G#; the rest of the chord is already diatonic.
    expect(outsideKeyPitchClasses(event(named(secondaryDominants(c), 'E7')))).toEqual([8]);
    // Fm brings A♭.
    expect(outsideKeyPitchClasses(event(named(modalInterchange(c), 'Fm')))).toEqual([8]);
    // D♭7 brings D♭, F♭(=E is diatonic), A♭ and C♭(=B is diatonic).
    expect(outsideKeyPitchClasses(event(named(substituteChords(c, 'major'), 'D♭7')))).toEqual([
      1, 8,
    ]);
  });

  it('decides from the notes, so no category list has to be maintained', () => {
    // A chord nobody enumerated: a plain triad on a chromatic root.
    const chromatic = {
      rootOffset: 1,
      suffix: '',
      definitionId: 'major',
      modeContext: 'major',
    } as unknown as ChordEvent;
    expect(isNonDiatonicChord(chromatic)).toBe(true);
  });
});

describe('the key a chord is heard in decides', () => {
  /**
   * A half-diminished seventh on scale degree 2 is the chromatic ♯iv in major and the
   * perfectly ordinary iiø in natural minor. Same quality, same interval from the
   * tonic, opposite answers — which is only possible because the mode the chord is
   * heard in travels with it.
   */
  it('reads the same chord differently in major and in minor', () => {
    const onDegreeTwo = {
      rootOffset: 2,
      suffix: 'm7♭5',
      definitionId: 'm7b5',
    } as unknown as ChordEvent;
    expect(isNonDiatonicChord({ ...onDegreeTwo, modeContext: 'major' } as ChordEvent)).toBe(true);
    expect(isNonDiatonicChord({ ...onDegreeTwo, modeContext: 'minor' } as ChordEvent)).toBe(false);
  });

  it('counts a slash bass that leaves the key', () => {
    const plainTonic = { rootOffset: 0, suffix: '', definitionId: 'major' } as unknown as ChordEvent;
    expect(isNonDiatonicChord(plainTonic)).toBe(false);
    expect(isNonDiatonicChord({ ...plainTonic, bassOffset: 6 } as ChordEvent)).toBe(true);
    expect(isNonDiatonicChord({ ...plainTonic, bassOffset: 4 } as ChordEvent)).toBe(false);
  });
});

describe('cycle positions handed to the renderer', () => {
  const c = 'C' as MajorKey;
  const diatonic = (name: string) => event(named(diatonicLibrary(c), name));

  it('is empty when every chord is diatonic', () => {
    expect(
      nonDiatonicCycleIndices([diatonic('C'), diatonic('Am'), diatonic('F'), diatonic('G')]),
    ).toEqual([]);
  });

  it('points at the borrowed chord and nothing else', () => {
    const borrowedIv = event(named(modalInterchange(c), 'Fm'));
    expect(
      nonDiatonicCycleIndices([diatonic('C'), diatonic('Am'), borrowedIv, diatonic('G')]),
    ).toEqual([2]);
  });

  it('points at a secondary dominant in the middle of a turnaround', () => {
    const e7 = event(named(secondaryDominants(c), 'E7'));
    expect(nonDiatonicCycleIndices([diatonic('C'), e7, diatonic('Am')])).toEqual([1]);
  });

  it('points at every chromatic chord when several are used', () => {
    const e7 = event(named(secondaryDominants(c), 'E7'));
    const db7 = event(named(substituteChords(c, 'major'), 'D♭7'));
    expect(
      nonDiatonicCycleIndices([diatonic('C'), e7, diatonic('Am'), db7, diatonic('C')]),
    ).toEqual([1, 3]);
  });
});

describe('harmonic function survives the aura', () => {
  it('keeps a borrowed iv subdominant so its body colour stays yellow', () => {
    const fm = named(modalInterchange('C' as MajorKey), 'Fm');
    expect(fm.function).toBe('subdominant');
    expect(isNonDiatonicChord(event(fm))).toBe(true);
  });

  it('keeps secondary dominants and substitutes dominant so their body stays red', () => {
    for (const chord of [
      named(secondaryDominants('C' as MajorKey), 'E7'),
      named(substituteChords('C' as MajorKey, 'major'), 'D♭7'),
      named(substituteChords('C' as MajorKey, 'major'), 'B♭7'),
    ]) {
      expect(chord.function).toBe('dominant');
    }
  });

  /**
   * A passing diminished has no destination of its own, so it borrows the function of
   * the chord it leads to. `C#dim7 → Dm7` is subdominant motion; calling it a dominant
   * would tell the player it wants to reach the tonic.
   */
  it('gives a passing diminished the function of the chord it leads to', () => {
    const passing = passingDiminishedChords('C' as MajorKey);
    expect(
      passing.map((chord) => `${chord.displayName} ${chord.subLabel} ${chord.function}`),
    ).toEqual([
      'C#dim7 →Dm7 subdominant',
      'E♭dim7 →Dm7 subdominant',
      'F#dim7 →G7 dominant',
      'G#dim7 →Am7 tonic',
    ]);
  });
});
