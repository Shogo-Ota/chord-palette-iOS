import { addChord, getSession, setMode, startNew } from '@/features/editor/session';
import { offsetFromTonic } from '@/data/music';

/**
 * Switching the reference mode is a *reading* change, not an arrangement change: the
 * same chords stay in place at the same pitch, and only their degree names (and the
 * seven cards the library offers) follow the new mode.
 */

function place(rootOffset: number, degreeLabel: string, displayName: string): void {
  addChord({
    chordId: displayName,
    displayName,
    degreeLabel,
    function: 'tonic',
    durationBeats: 4,
    isPro: false,
    rootOffset,
    suffix: '',
    definitionId: 'maj',
  });
}

describe('editor key mode', () => {
  beforeEach(() => startNew());

  it('starts in major', () => {
    expect(getSession().mode).toBe('major');
  });

  it('relabels the same chords with natural-minor degrees', () => {
    place(0, 'I', 'C');
    place(5, 'IV', 'F');
    place(7, 'V', 'G');

    setMode('minor');

    expect(getSession().progression.map((e) => e.degreeLabel)).toEqual(['i', 'iv', 'v']);
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

  it('falls back to a chromatic degree when the root is outside the minor scale', () => {
    place(9, 'vi', 'A'); // 6th degree of C major; not in C natural minor

    setMode('minor');

    expect(getSession().progression[0]?.degreeLabel).toBe('VI');
  });

  it('stamps the mode each chord was entered under', () => {
    place(0, 'I', 'C');
    setMode('minor');
    place(5, 'iv', 'F');

    expect(getSession().progression.map((e) => e.modeContext)).toEqual(['minor', 'minor']);
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

  it('goes back to major degrees on the way out', () => {
    place(2, 'ii', 'D');

    setMode('minor');
    expect(getSession().progression[0]?.degreeLabel).toBe('ii°');

    setMode('major');
    expect(getSession().progression[0]?.degreeLabel).toBe('ii');
  });
});
