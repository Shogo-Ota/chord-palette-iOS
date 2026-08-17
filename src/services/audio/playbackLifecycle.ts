import type { PlaybackState } from '@/services/audio/types';

type PlaybackLifecyclePorts<Request> = {
  getState: () => PlaybackState;
  prepare: () => Promise<void>;
  play: (request: Request) => Promise<void>;
  stop: () => Promise<void>;
  teardown: () => Promise<void>;
};

/**
 * Serializes the control plane around the native audio engine.
 *
 * Musical time remains entirely native. This coordinator only guarantees that:
 * - a cold `play` cannot overtake `prepare`;
 * - a newer play wins over an older queued play;
 * - stop/teardown invalidate a play waiting behind SoundFont preparation.
 */
export class PlaybackLifecycleCoordinator<Request> {
  private generation = 0;
  private prepareInFlight: Promise<void> | null = null;
  private playChain: Promise<void> = Promise.resolve();

  constructor(private readonly ports: PlaybackLifecyclePorts<Request>) {}

  prepare(): Promise<void> {
    if (!this.prepareInFlight) {
      const task = this.ports.prepare();
      this.prepareInFlight = task;
      void task.then(
        () => {
          if (this.prepareInFlight === task) this.prepareInFlight = null;
        },
        () => {
          if (this.prepareInFlight === task) this.prepareInFlight = null;
        },
      );
    }
    return this.prepareInFlight;
  }

  play(request: Request): Promise<void> {
    const generation = ++this.generation;
    this.playChain = this.playChain
      .catch(() => undefined)
      .then(async () => {
        if (generation !== this.generation) return;
        const state = this.ports.getState();
        if (
          this.prepareInFlight ||
          state === 'idle' ||
          state === 'preparing' ||
          state === 'failed'
        ) {
          await this.prepare();
        }
        if (generation !== this.generation) return;
        await this.ports.play(request);
      });
    return this.playChain;
  }

  async stop(): Promise<void> {
    this.generation += 1;
    await this.playChain.catch(() => undefined);
    await this.ports.stop();
  }

  async teardown(): Promise<void> {
    this.generation += 1;
    await this.prepareInFlight?.catch(() => undefined);
    await this.playChain.catch(() => undefined);
    await this.ports.teardown();
  }
}
