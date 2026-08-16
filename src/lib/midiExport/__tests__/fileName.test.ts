import {
  midiExportBpmToken,
  midiExportFileName,
  midiExportInstrumentToken,
  midiExportProgressionToken,
  midiExportStyleToken,
  midiExportTypeToken,
} from '../fileName';

const NOW = 1786692801082;

describe('midiExportFileName', () => {
  it('maps Production styles and types', () => {
    expect(midiExportStyleToken('block')).toBe('Block');
    expect(midiExportStyleToken('natural')).toBe('Natural');
    expect(midiExportStyleToken('city')).toBe('City');
    expect(midiExportStyleToken('arpeggio')).toBe('Variation');
    expect(midiExportTypeToken('block', 'block.type1')).toBe('Type1');
    expect(midiExportTypeToken('natural', 'natural.type2')).toBe('Type2');
    expect(midiExportTypeToken('city', 'city.type1')).toBe('Type1');
    expect(midiExportTypeToken('arpeggio', 'arpeggio.type3')).toBe('Type3');
  });

  it('joins a normal chord progression with hyphens', () => {
    expect(
      midiExportProgressionToken([
        { displayName: 'C' },
        { displayName: 'Am' },
        { displayName: 'F' },
        { displayName: 'G' },
      ]),
    ).toBe('C-Am-F-G');
  });

  it('maps accidentals to ASCII', () => {
    expect(midiExportProgressionToken([{ displayName: 'D♭' }, { displayName: 'F#' }])).toBe('Db-Fs');
    expect(midiExportProgressionToken([{ displayName: 'C♯m' }])).toBe('Csm');
  });

  it('rewrites slash chords with _on_', () => {
    expect(midiExportProgressionToken([{ displayName: 'C/E' }])).toBe('C_on_E');
    expect(midiExportProgressionToken([{ displayName: 'Dm/F' }])).toBe('Dm_on_F');
  });

  it('keeps the first 8 chords and appends -etc', () => {
    expect(
      midiExportProgressionToken([
        { displayName: 'C' },
        { displayName: 'Dm' },
        { displayName: 'Em' },
        { displayName: 'F' },
        { displayName: 'G' },
        { displayName: 'Am' },
        { displayName: 'Bdim' },
        { displayName: 'C' },
        { displayName: 'F' },
        { displayName: 'G' },
      ]),
    ).toBe('C-Dm-Em-F-G-Am-Bdim-C-etc');
  });

  it('spells Piano and E.Piano', () => {
    expect(midiExportInstrumentToken('piano')).toBe('Piano');
    expect(midiExportInstrumentToken('ePiano')).toBe('E.Piano');
  });

  it('formats BPM as an integer plus bpm', () => {
    expect(midiExportBpmToken(72)).toBe('72bpm');
    expect(midiExportBpmToken(100)).toBe('100bpm');
    expect(midiExportBpmToken(87.4)).toBe('87bpm');
  });

  it('builds the canonical example name', () => {
    expect(
      midiExportFileName({
        accompanimentPattern: 'natural',
        accompanimentVariant: 'natural.type2',
        instrumentId: 'piano',
        tempoBpm: 72,
        progression: [
          { displayName: 'C' },
          { displayName: 'Am' },
          { displayName: 'F' },
          { displayName: 'G' },
        ],
        now: NOW,
      }),
    ).toBe('chord-palette-Natural-Type2-Piano-72bpm-C-Am-F-G-1786692801082.mid');
  });

  it('is deterministic except the timestamp', () => {
    const input = {
      accompanimentPattern: 'arpeggio' as const,
      accompanimentVariant: 'arpeggio.type1',
      instrumentId: 'ePiano' as const,
      tempoBpm: 100,
      progression: [
        { displayName: 'C/E' },
        { displayName: 'D♭' },
        { displayName: 'F#' },
      ],
    };
    expect(midiExportFileName({ ...input, now: NOW })).toBe(
      'chord-palette-Variation-Type1-E.Piano-100bpm-C_on_E-Db-Fs-1786692801082.mid',
    );
    expect(midiExportFileName({ ...input, now: NOW })).toBe(
      midiExportFileName({ ...input, now: NOW }),
    );
  });
});
