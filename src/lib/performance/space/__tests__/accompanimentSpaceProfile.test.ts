import { accompanimentSpaceProfileFor } from '../accompanimentSpaceProfile';

describe('accompaniment space profile', () => {
  it.each(['natural.type3', 'city.type1'])('gives %s the approved subtle small room', (variant) => {
    expect(accompanimentSpaceProfileFor(variant)).toEqual({
      reverbPreset: 'smallRoom',
      reverbWetDryMix: 8,
    });
  });

  it.each([
    undefined,
    'block.type1',
    'natural.type1',
    'natural.type2',
    'natural.type4',
    'natural.type5',
    'natural.dance1',
  ])('keeps %s dry', (variant) => {
    expect(accompanimentSpaceProfileFor(variant)).toEqual({
      reverbPreset: 'off',
      reverbWetDryMix: 0,
    });
  });
});
