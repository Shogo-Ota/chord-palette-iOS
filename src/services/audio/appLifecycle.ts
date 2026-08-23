import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { logger } from '@/lib/logger';
import { audioService } from '@/services/audio';
import { AudioAppLifecycleCoordinator } from '@/services/audio/appLifecycleCoordinator';

const coordinator = new AudioAppLifecycleCoordinator(audioService);

/** Root-level hook; all native access remains behind AudioService. */
export function useAudioAppLifecycle(): void {
  const previous = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const before = previous.current;
      previous.current = next;
      coordinator
        .transition(before, next)
        .then(() => audioService.logPlaybackDiagnostics(`appState ${before}->${next}`))
        .catch((error) =>
          logger.error('Audio app-state recovery failed', {
            previous: before,
            next,
            error: String(error),
          }),
        );
    });
    return () => subscription.remove();
  }, []);
}
