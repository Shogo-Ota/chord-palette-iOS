import { addChord, getSession, setMode, startNew, transposeTo } from '@/features/editor/session';
import { offsetFromTonic } from '@/data/music';
import { definitionIdForSuffix } from '@/lib/theory/definitions';

/**
 * Switching mode starts a new authoring section. Chords already placed retain the
 * degree system they were entered under; new chords use the newly selected mode.
 */

function place(rootOffset: number, degreeLabel: string, displayName: string, suffix = ''): void {
  addChord({
    chordId: displayName,
    displayName,
    degreeLabel,
    function: 'tonic',
    durationBeats: 4,
    isPro: false,
    rootOffset,
    suffix,
    definitionId: definitionIdForSuffix(suffix),
  });
}

describe('editor key mode', () => {
  beforeEach(() => startNew());

  it('starts in major', () => {
    expect(getSession().mode).toBe('major');
  });

  it('preserves the degree labels of the existing major section', () => {
    place(0, 'I', 'C');
    place(5, 'IV', 'F');
    place(7, 'V', 'G');

    setMode('minor');

    expect(getSession().progression.map((e) => e.degreeLabel)).toEqual(['I', 'IV', 'V']);
  });

  it('leaves every chord on its original pitch', () => {
    place(0, 'I', 'C');
    place(5, 'IV', 'F');
    place(9, 'vi', 'A');
    const before = getSession().progression.map((e) => e.rootOffset);

    setMode('minor');

    const { key, progression: after } = getSession();
    expect(after.map((e) => e.rootOffset)).toEqual(before);
    // Names are respelled per mode, so compare sounding pitch rather than letters.
    after.forEach((e) => {
      expect(offsetFromTonic(key, e.displayName)).toBe(e.rootOffset);
    });
  });

  it('renders consecutive C-major and C-minor sections with independent case', () => {
    place(0, 'I', 'C');
    place(5, 'IV', 'F');
    place(7, 'V', 'G');
    place(0, 'I', 'C');

    setMode('minor');
    place(0, 'i', 'Cm', 'm');
    place(5, 'iv', 'Fm', 'm');
    place(7, 'v', 'Gm', 'm');
    place(0, 'i', 'Cm', 'm');

    expect(getSession().progression.map((e) => e.degreeLabel)).toEqual([
      'I',
      'IV',
      'V',
      'I',
      'i',
      'iv',
      'v',
      'i',
    ]);
  });

  it('stamps the mode each chord was entered under', () => {
    place(0, 'I', 'C');
    setMode('minor');
    place(5, 'iv', 'Fm', 'm');

    expect(getSession().progression.map((e) => e.modeContext)).toEqual(['major', 'minor']);
  });

  it('is a no-op when the mode is already current', () => {
    place(0, 'I', 'C');
    const before = getSession().progression;

    setMode('major');

    expect(getSession().progression).toBe(before);
  });

  it('leaves the dirty flag alone when the mode is already current', () => {
    const before = getSession().dirty;

    setMode('major');

    expect(getSession().dirty).toBe(before);
  });

  it('starts another major section without rewriting the minor section', () => {
    place(2, 'ii', 'D');

    setMode('minor');
    place(2, 'ii°', 'Ddim', 'dim');

    setMode('major');
    place(4, 'iii', 'Em', 'm');

    expect(getSession().progression.map((e) => e.degreeLabel)).toEqual(['ii', 'ii°', 'iii']);
    expect(getSession().progression.map((e) => e.modeContext)).toEqual(['major', 'minor', 'major']);
  });

  it('transposes a mixed-mode song without flattening its degree case', () => {
    place(0, 'I', 'C');
    place(5, 'IV', 'F');
    place(7, 'V', 'G');
    place(0, 'I', 'C');
    setMode('minor');
    place(0, 'i', 'Cm', 'm');
    place(5, 'iv', 'Fm', 'm');
    place(7, 'v', 'Gm', 'm');
    place(0, 'i', 'Cm', 'm');

    transposeTo('D');

    expect(getSession().progression.map((e) => e.displayName)).toEqual([
      'D',
      'G',
      'A',
      'D',
      'Dm',
      'Gm',
      'Am',
      'Dm',
    ]);
    expect(getSession().progression.map((e) => e.degreeLabel)).toEqual([
      'I',
      'IV',
      'V',
      'I',
      'i',
      'iv',
      'v',
      'i',
    ]);
    expect(getSession().progression.map((e) => e.modeContext)).toEqual([
      'major',
      'major',
      'major',
      'major',
      'minor',
      'minor',
      'minor',
      'minor',
    ]);
  });
});
