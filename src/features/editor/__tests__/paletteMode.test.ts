import {
  addChord,
  getSession,
  setMode,
  setPaletteMode,
  setSelected,
  replaceSelected,
  startNew,
} from '@/features/editor/session';

beforeEach(() => {
  startNew();
});

function fm() {
  return {
    chordId: 'Fm',
    displayName: 'Fm',
    degreeLabel: 'iv',
    rootOffset: 5,
    suffix: 'm',
    function: 'subdominant' as const,
    durationBeats: 4 as const,
    isPro: false,
  };
}

describe('the song mode and the chord list on screen are separate', () => {
  it('starts the palette on the song mode', () => {
    const s = getSession();
    expect(s.paletteMode).toBe(s.mode);
  });

  it('brings the palette along when the song mode changes', () => {
    setMode('minor');
    expect(getSession().paletteMode).toBe('minor');
    setMode('major');
    expect(getSession().paletteMode).toBe('major');
  });

  it('leaves the song in major when only the palette moves', () => {
    setPaletteMode('minor');
    const s = getSession();
    expect(s.paletteMode).toBe('minor');
    expect(s.mode).toBe('major');
  });

  it('does not count looking at the other list as an edit', () => {
    const before = getSession().dirty;
    setPaletteMode('minor');
    expect(getSession().dirty).toBe(before);
  });

  it('puts the palette back under the song mode once the song mode is declared', () => {
    setPaletteMode('minor');
    setMode('minor');
    setMode('major');
    expect(getSession().paletteMode).toBe('major');
  });
});

describe('a chord records which list it came from', () => {
  it('stamps the palette mode rather than the song mode', () => {
    setPaletteMode('minor');
    addChord(fm());
    const [event] = getSession().progression;
    expect(event?.modeContext).toBe('minor');
    expect(getSession().mode).toBe('major');
  });

  it('stamps it on a replacement too', () => {
    addChord(fm());
    setSelected(0);
    setPaletteMode('minor');
    replaceSelected({ ...fm(), displayName: 'Fm7', suffix: 'm7' });
    expect(getSession().progression[0]?.modeContext).toBe('minor');
  });

  it('keeps the song mode out of the stamp when only the palette is minor', () => {
    setPaletteMode('minor');
    addChord(fm());
    expect(getSession().progression[0]?.keyContext).toBe('C');
    expect(getSession().mode).toBe('major');
  });
});
