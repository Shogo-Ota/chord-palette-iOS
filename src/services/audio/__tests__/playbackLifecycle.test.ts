import { PlaybackLifecycleCoordinator } from '@/services/audio/playbackLifecycle';
import type { PlaybackState } from '@/services/audio/types';

type Request = {
  id: string;
  loop: boolean;
  style: 'natural' | 'block';
  progression: string;
};

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture(initialState: PlaybackState = 'idle') {
  let state = initialState;
  const coldPrepare = deferred();
  const calls: string[] = [];
  const prepare = jest.fn(async () => {
    calls.push('prepare.start');
    await coldPrepare.promise;
    state = 'ready';
    calls.push('prepare.end');
  });
  const play = jest.fn(async (request: Request) => {
    calls.push(`play:${request.id}`);
    state = 'playing';
  });
  const stop = jest.fn(async () => {
    calls.push('stop');
    state = 'stopped';
  });
  const teardown = jest.fn(async () => {
    calls.push('teardown');
    state = 'idle';
  });
  const lifecycle = new PlaybackLifecycleCoordinator<Request>({
    getState: () => state,
    prepare,
    play,
    stop,
    teardown,
  });
  return {
    lifecycle,
    coldPrepare,
    calls,
    prepare,
    play,
    stop,
    setState: (next: PlaybackState) => {
      state = next;
    },
  };
}

function request(id: string, overrides: Partial<Omit<Request, 'id'>> = {}): Request {
  return {
    id,
    loop: true,
    style: 'natural',
    progression: 'F|G|Em|Am',
    ...overrides,
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('first playback lifecycle matrix', () => {
  it.each([true, false])('Fresh launch → Loop %s → Play waits for readiness', async (loop) => {
    const f = fixture('idle');
    const pending = f.lifecycle.play(request(`fresh-${loop}`, { loop }));
    await flushMicrotasks();

    expect(f.prepare).toHaveBeenCalledTimes(1);
    expect(f.play).not.toHaveBeenCalled();

    f.coldPrepare.resolve();
    await pending;
    expect(f.calls).toEqual(['prepare.start', 'prepare.end', `play:fresh-${loop}`]);
  });

  it('Stop → Play starts a new generation', async () => {
    const f = fixture('ready');
    await f.lifecycle.play(request('first'));
    await f.lifecycle.stop();
    await f.lifecycle.play(request('restart'));

    expect(f.calls).toEqual(['play:first', 'stop', 'play:restart']);
  });

  it('Loop ON → OFF → Play keeps only the newest cold request', async () => {
    const f = fixture('idle');
    const first = f.lifecycle.play(request('loop-on', { loop: true }));
    await flushMicrotasks();
    const second = f.lifecycle.play(request('loop-off', { loop: false }));

    f.coldPrepare.resolve();
    await Promise.all([first, second]);
    expect(f.play).toHaveBeenCalledTimes(1);
    expect(f.play).toHaveBeenCalledWith(expect.objectContaining({ id: 'loop-off', loop: false }));
  });

  it('Loop OFF → ON → Play keeps only the newest cold request', async () => {
    const f = fixture('idle');
    const first = f.lifecycle.play(request('loop-off', { loop: false }));
    await flushMicrotasks();
    const second = f.lifecycle.play(request('loop-on', { loop: true }));

    f.coldPrepare.resolve();
    await Promise.all([first, second]);
    expect(f.play).toHaveBeenCalledTimes(1);
    expect(f.play).toHaveBeenCalledWith(expect.objectContaining({ id: 'loop-on', loop: true }));
  });

  it('Natural → Block → Natural cannot revive a stale style plan', async () => {
    const f = fixture('idle');
    const natural1 = f.lifecycle.play(request('natural-1'));
    await flushMicrotasks();
    const block = f.lifecycle.play(request('block', { style: 'block' }));
    const natural2 = f.lifecycle.play(request('natural-2'));

    f.coldPrepare.resolve();
    await Promise.all([natural1, block, natural2]);
    expect(f.play).toHaveBeenCalledTimes(1);
    expect(f.play).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'natural-2', style: 'natural' }),
    );
  });

  it('Progression change → Play cannot revive the old progression', async () => {
    const f = fixture('idle');
    const oldPlan = f.lifecycle.play(request('old'));
    await flushMicrotasks();
    const newPlan = f.lifecycle.play(request('new', { progression: 'C|Am|F|G' }));

    f.coldPrepare.resolve();
    await Promise.all([oldPlan, newPlan]);
    expect(f.play).toHaveBeenCalledTimes(1);
    expect(f.play).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new', progression: 'C|Am|F|G' }),
    );
  });

  it('Stop during cold prepare prevents playback after readiness resolves', async () => {
    const f = fixture('idle');
    const pendingPlay = f.lifecycle.play(request('cancelled'));
    await flushMicrotasks();
    const pendingStop = f.lifecycle.stop();

    f.coldPrepare.resolve();
    await Promise.all([pendingPlay, pendingStop]);
    expect(f.play).not.toHaveBeenCalled();
    expect(f.stop).toHaveBeenCalledTimes(1);
  });
});
