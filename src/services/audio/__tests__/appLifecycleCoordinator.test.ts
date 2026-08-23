import { AudioAppLifecycleCoordinator } from '@/services/audio/appLifecycleCoordinator';
import type { PlaybackState } from '@/services/audio/types';

describe('AudioAppLifecycleCoordinator', () => {
  function setup(initial: PlaybackState = 'playing') {
    let state = initial;
    const pause = jest.fn(async () => {
      state = 'paused';
    });
    const prepare = jest.fn(async () => undefined);
    const coordinator = new AudioAppLifecycleCoordinator({
      getState: () => state,
      pause,
      prepare,
    });
    return { coordinator, pause, prepare };
  }

  it('pauses once when active playback leaves the foreground', async () => {
    const { coordinator, pause } = setup();
    await coordinator.transition('active', 'inactive');
    await coordinator.transition('inactive', 'background');
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('re-arms on foreground without auto-resuming', async () => {
    const { coordinator, pause, prepare } = setup('paused');
    await coordinator.transition('background', 'active');
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();
  });

  it('serializes a fast background/foreground transition', async () => {
    const { coordinator, pause, prepare } = setup();
    await Promise.all([
      coordinator.transition('active', 'background'),
      coordinator.transition('background', 'active'),
    ]);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledTimes(1);
  });
});
