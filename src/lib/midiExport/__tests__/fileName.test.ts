import { PUBLIC_STYLES } from '@/lib/performance/publicStyleCatalog';
import { resolveVariant } from '@/lib/performance/variants';

import {
  midiExportBpmToken,
  midiExportFileName,
  midiExportInstrumentToken,
  midiExportProgressionToken,
  midiExportStyleToken,
} from '../fileName';

const NOW = 1786692801082;

/** The eight STYLEs the release offers, as the player reads them on screen. */
const SELECTIONS = [
  ['Block', 'block', 'block.type1'],
  ['Natural-Type1', 'natural', 'natural.type1'],
  ['Natural-Type2', 'natural', 'natural.type2'],
  ['Variation-City', 'city', 'city.type1'],
  ['Variation-Funk', 'natural', 'natural.type3'],
  ['Variation-Driving', 'natural', 'natural.type4'],
  ['Variation-Dance', 'natural', 'natural.dance1'],
  ['Arpeggio', 'natural', 'natural.type5'],
] as const;

/** Names that leaked from the internal pattern/variant ids before this was derived. */
const RETIRED_TOKENS = [
  'Natural-Type3',
  'Natural-Type4',
  'Natural-Type5',
  'Natural-dance1',
  'City-Type1',
  'Block-Type1',
];

describe('midiExportFileName', () => {
  it.each(SELECTIONS)('names the %s selection after the STYLE on screen', (label, pattern, variant) => {
    expect(midiExportStyleToken(pattern, variant)).toBe(label);
  });

  it('covers every selectable STYLE exactly once', () => {
    expect(PUBLIC_STYLES.map((style) => `${style.pattern}/${style.variant}`)).toEqual(
      SELECTIONS.map(([, pattern, variant]) => `${pattern}/${variant}`),
    );
  });

  it('never spells an internal pattern or variant id', () => {
    const names = SELECTIONS.map(([, pattern, variant]) =>
      midiExportFileName({
        accompanimentPattern: pattern,
        accompanimentVariant: variant,
        instrumentId: 'piano',
        tempoBpm: 140,
        progression: [{ displayName: 'C' }],
        now: NOW,
      }),
    );

    for (const name of names) {
      for (const retired of RETIRED_TOKENS) {
        expect(name).not.toContain(retired);
      }
      expect(name).not.toMatch(/dance1|type\d|Ballad/);
    }
  });

  it('names the STYLE the engine will actually play', () => {
    for (const [label, pattern, variant] of SELECTIONS) {
      expect(resolveVariant(pattern, variant).id).toBe(variant);
      expect(midiExportStyleToken(pattern, variant)).toBe(label);
    }
  });

  it('falls back to the default STYLE for an unknown selection', () => {
    expect(midiExportStyleToken('natural', 'natural.retired')).toBe('Natural-Type1');
    expect(midiExportStyleToken('natural')).toBe('Natural-Type1');
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
      accompanimentPattern: 'city' as const,
      accompanimentVariant: 'city.type1',
      instrumentId: 'ePiano' as const,
      tempoBpm: 100,
      progression: [
        { displayName: 'C/E' },
        { displayName: 'D♭' },
        { displayName: 'F#' },
      ],
    };
    expect(midiExportFileName({ ...input, now: NOW })).toBe(
      'chord-palette-Variation-City-E.Piano-100bpm-C_on_E-Db-Fs-1786692801082.mid',
    );
    expect(midiExportFileName({ ...input, now: NOW })).toBe(
      midiExportFileName({ ...input, now: NOW }),
    );
  });

  it('follows a STYLE change instead of carrying the previous export', () => {
    const base = {
      instrumentId: 'piano' as const,
      tempoBpm: 140,
      progression: [{ displayName: 'Am' }, { displayName: 'G' }],
      now: NOW,
    };
    const first = midiExportFileName({
      ...base,
      accompanimentPattern: 'natural',
      accompanimentVariant: 'natural.type4',
    });
    const second = midiExportFileName({
      ...base,
      accompanimentPattern: 'natural',
      accompanimentVariant: 'natural.dance1',
    });

    expect(first).toBe('chord-palette-Variation-Driving-Piano-140bpm-Am-G-1786692801082.mid');
    expect(second).toBe('chord-palette-Variation-Dance-Piano-140bpm-Am-G-1786692801082.mid');
    expect(
      midiExportFileName({
        ...base,
        accompanimentPattern: 'natural',
        accompanimentVariant: 'natural.type4',
      }),
    ).toBe(first);
  });

  it('reflects a tempo or progression change', () => {
    const base = {
      accompanimentPattern: 'block' as const,
      accompanimentVariant: 'block.type1',
      instrumentId: 'piano' as const,
      now: NOW,
    };

    expect(
      midiExportFileName({
        ...base,
        tempoBpm: 112,
        progression: [
          { displayName: 'F' },
          { displayName: 'G' },
          { displayName: 'Em' },
          { displayName: 'Am' },
        ],
      }),
    ).toBe('chord-palette-Block-Piano-112bpm-F-G-Em-Am-1786692801082.mid');
    expect(
      midiExportFileName({
        ...base,
        tempoBpm: 140,
        progression: [{ displayName: 'C' }, { displayName: 'G' }],
      }),
    ).toBe('chord-palette-Block-Piano-140bpm-C-G-1786692801082.mid');
  });
});
