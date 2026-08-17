const mockGetFirstAsync = jest.fn();
const mockRunAsync = jest.fn();

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(async () => ({
    getFirstAsync: mockGetFirstAsync,
    runAsync: mockRunAsync,
  })),
}));

import {
  DEFAULT_OCTAVE_SHIFT,
  getOctaveShift,
  setOctaveShiftPref,
} from '../sessionPrefsRepository';

describe('session octave preference', () => {
  beforeEach(() => {
    mockGetFirstAsync.mockReset();
    mockRunAsync.mockReset();
  });

  it('uses the neutral compact register when no v2 preference exists', async () => {
    mockGetFirstAsync.mockResolvedValue(null);

    expect(DEFAULT_OCTAVE_SHIFT).toBe(0);
    await expect(getOctaveShift()).resolves.toBe(0);
    expect(mockGetFirstAsync).toHaveBeenCalledWith('SELECT value FROM app_meta WHERE key = ?;', [
      'octave_shift_v2',
    ]);
  });

  it('honors a future explicit v2 octave choice', async () => {
    mockGetFirstAsync.mockResolvedValue({ value: '1' });

    await expect(getOctaveShift()).resolves.toBe(1);
  });

  it('falls back to neutral for an invalid stored value', async () => {
    mockGetFirstAsync.mockResolvedValue({ value: 'not-a-number' });

    await expect(getOctaveShift()).resolves.toBe(0);
  });

  it('writes explicit choices only to the v2 preference key', async () => {
    await setOctaveShiftPref(1);

    expect(mockRunAsync).toHaveBeenCalledWith(
      'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);',
      ['octave_shift_v2', '1'],
    );
  });
});
