import {
  getVideoMotionPreference,
  setVideoMotionPreference,
} from '../videoMotionPreferenceRepository';

const mockGetFirstAsync = jest.fn();
const mockRunAsync = jest.fn();

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(async () => ({
    getFirstAsync: mockGetFirstAsync,
    runAsync: mockRunAsync,
  })),
}));

describe('video motion preference repository', () => {
  beforeEach(() => {
    mockGetFirstAsync.mockReset();
    mockRunAsync.mockReset();
  });

  it.each([null, { value: 'unknown' }, { value: '' }])(
    'falls back to Standard for %p',
    async (stored) => {
      mockGetFirstAsync.mockResolvedValue(stored);
      await expect(getVideoMotionPreference()).resolves.toBe('standard');
    },
  );

  it('restores and writes reduced motion in app_meta', async () => {
    mockGetFirstAsync.mockResolvedValue({ value: 'reduced' });
    await expect(getVideoMotionPreference()).resolves.toBe('reduced');
    await setVideoMotionPreference('reduced');
    expect(mockRunAsync).toHaveBeenCalledWith(
      'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);',
      ['video_compare_motion', 'reduced'],
    );
  });
});
