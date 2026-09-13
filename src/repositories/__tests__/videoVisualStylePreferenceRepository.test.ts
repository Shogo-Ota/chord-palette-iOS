import {
  getVideoVisualStylePreference,
  setVideoVisualStylePreference,
} from '../videoVisualStylePreferenceRepository';

const mockGetFirstAsync = jest.fn();
const mockRunAsync = jest.fn();

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(async () => ({
    getFirstAsync: mockGetFirstAsync,
    runAsync: mockRunAsync,
  })),
}));

describe('video visual style preference repository', () => {
  beforeEach(() => {
    mockGetFirstAsync.mockReset();
    mockRunAsync.mockReset();
  });

  it.each([null, { value: 'evolution' }, { value: '' }, { value: 'pulse' }])(
    'falls back to Classic for missing or invalid stored value %p',
    async (stored) => {
      mockGetFirstAsync.mockResolvedValue(stored);

      await expect(getVideoVisualStylePreference()).resolves.toBe('classic');
      expect(mockGetFirstAsync).toHaveBeenCalledWith('SELECT value FROM app_meta WHERE key = ?;', [
        'video_visual_style',
      ]);
    },
  );

  it.each(['classic', 'flow'] as const)('restores valid %s value', async (stored) => {
    mockGetFirstAsync.mockResolvedValue({ value: stored });

    await expect(getVideoVisualStylePreference()).resolves.toBe(stored);
  });

  it('writes the selected style to app_meta without a migration', async () => {
    await setVideoVisualStylePreference('flow');

    expect(mockRunAsync).toHaveBeenCalledWith(
      'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);',
      ['video_visual_style', 'flow'],
    );
  });
});
