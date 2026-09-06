import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { VideoVisualStyle } from '@/services/videoExport/videoVisualStyle';

import {
  useVideoVisualStylePreference,
  type VideoVisualStylePreferenceDependencies,
} from '../useVideoVisualStylePreference';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function dependencies(
  overrides: Partial<VideoVisualStylePreferenceDependencies> = {},
): VideoVisualStylePreferenceDependencies & {
  load: jest.Mock<Promise<VideoVisualStyle>, []>;
  save: jest.Mock<Promise<void>, [VideoVisualStyle]>;
  trackSelection: jest.Mock<void, [VideoVisualStyle]>;
} {
  const load = jest.fn<Promise<VideoVisualStyle>, []>(async () => 'classic');
  const save = jest.fn<Promise<void>, [VideoVisualStyle]>(async () => undefined);
  const trackSelection = jest.fn<void, [VideoVisualStyle]>();
  if (overrides.load) load.mockImplementation(overrides.load);
  if (overrides.save) save.mockImplementation(overrides.save);
  if (overrides.trackSelection) trackSelection.mockImplementation(overrides.trackSelection);
  return {
    load,
    save,
    trackSelection,
  };
}

describe('useVideoVisualStylePreference', () => {
  it('renders Classic first, then restores a valid saved style', async () => {
    const deps = dependencies({ load: jest.fn(async () => 'pulse') });
    const { result } = renderHook(() => useVideoVisualStylePreference(deps));

    expect(result.current.visualStyle).toBe('classic');
    await waitFor(() => expect(result.current.visualStyle).toBe('pulse'));
    expect(deps.trackSelection).not.toHaveBeenCalled();
  });

  it.each(['classic', 'pulse', 'flow'] as const)(
    'selects, persists and tracks %s exactly once',
    async (visualStyle) => {
      const load = deferred<VideoVisualStyle>();
      const deps = dependencies({ load: jest.fn(() => load.promise) });
      const { result } = renderHook(() => useVideoVisualStylePreference(deps));

      act(() => result.current.selectVisualStyle(visualStyle));

      expect(result.current.visualStyle).toBe(visualStyle);
      expect(deps.save).toHaveBeenCalledTimes(1);
      expect(deps.save).toHaveBeenCalledWith(visualStyle);
      expect(deps.trackSelection).toHaveBeenCalledTimes(1);
      expect(deps.trackSelection).toHaveBeenCalledWith(visualStyle);
    },
  );

  it('falls back to Classic when loading fails', async () => {
    const deps = dependencies({
      load: jest.fn(async () => {
        throw new Error('load failed');
      }),
    });
    const { result } = renderHook(() => useVideoVisualStylePreference(deps));

    await waitFor(() => expect(result.current.visualStyle).toBe('classic'));
  });

  it('falls back to Classic when saving the latest selection fails', async () => {
    const deps = dependencies({
      save: jest.fn(async () => {
        throw new Error('save failed');
      }),
    });
    const { result } = renderHook(() => useVideoVisualStylePreference(deps));

    act(() => result.current.selectVisualStyle('flow'));
    await waitFor(() => expect(result.current.visualStyle).toBe('classic'));
  });

  it('does not let a late initial load overwrite a user selection', async () => {
    const load = deferred<VideoVisualStyle>();
    const deps = dependencies({ load: jest.fn(() => load.promise) });
    const { result } = renderHook(() => useVideoVisualStylePreference(deps));

    act(() => result.current.selectVisualStyle('flow'));
    await act(async () => load.resolve('pulse'));

    expect(result.current.visualStyle).toBe('flow');
  });
});
