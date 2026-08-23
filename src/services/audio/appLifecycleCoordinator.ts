import type { AppStateStatus } from 'react-native';

import type { PlaybackState } from '@/services/audio/types';

export type AudioLifecyclePorts = {
  getState: () => PlaybackState;
  pause: () => Promise<void>;
  prepare: () => Promise<void>;
};

/**
 * Serializes OS app-state transitions around the audio service.
 *
 * Backgrounding pauses at an exact musical position. Foregrounding only re-arms
 * the engine; it never surprises the user by auto-resuming.
 */
export class AudioAppLifecycleCoordinator {
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly ports: AudioLifecyclePorts) {}

  transition(previous: AppStateStatus, next: AppStateStatus): Promise<void> {
    if (previous === next) return this.chain;
    this.chain = this.chain
      .catch(() => undefined)
      .then(async () => {
        if (next === 'inactive' || next === 'background') {
          if (this.ports.getState() === 'playing') await this.ports.pause();
          return;
        }
        if (next === 'active' && (previous === 'inactive' || previous === 'background')) {
          await this.ports.prepare();
        }
      });
    return this.chain;
  }
}
