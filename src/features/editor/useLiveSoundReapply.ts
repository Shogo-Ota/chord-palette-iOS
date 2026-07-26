import { useEffect, useRef } from 'react';

import { chordPreviewRequest, sessionToPlaybackRequest } from '@/features/editor/playback';
import type { EditorSession } from '@/features/editor/session';
import { logger } from '@/lib/logger';
import { audioService } from '@/services/audio';
import { getTier } from '@/services/billing';
import type { PlaybackState } from '@/services/audio/types';

/**
 * When instrument / groove / accompaniment / releaseCut change on the Groove
 * screen, re-apply them to the native engine immediately so the audition
 * reflects the change without a manual restart. Lives here (not in the editor)
 * because those controls only exist on `/groove`, and the editor may be frozen
 * while this screen is focused.
 *
 * The `sound` argument is the source of truth to audition — on the Groove screen
 * this is the committed session merged with the local style draft, so previewing
 * never mutates the session until the user confirms.
 *
 * Instrument-only: prefer native hot-swap (`setInstrument`). If the installed
 * binary lacks it, rebuild via `play` at the current beat so the playhead does
 * not jump to the first chord. Groove / accompaniment / releaseCut always
 * rebuild the note plan.
 */
export function useLiveSoundReapply(
  playbackState: PlaybackState,
  loop: boolean,
  sound: EditorSession,
): void {
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const didMountRef = useRef(false);
  const prevRef = useRef({
    instrumentId: sound.instrumentId,
    grooveId: sound.grooveId,
    accompanimentPattern: sound.accompanimentPattern,
    accompanimentVariant: sound.accompanimentVariant,
    releaseCut: sound.releaseCut,
    octaveShift: sound.octaveShift,
  });

  useEffect(() => {
    const prev = prevRef.current;
    const instrumentChanged = prev.instrumentId !== sound.instrumentId;
    const grooveChanged = prev.grooveId !== sound.grooveId;
    const accompChanged =
      prev.accompanimentPattern !== sound.accompanimentPattern ||
      prev.accompanimentVariant !== sound.accompanimentVariant;
    const releaseCutChanged = prev.releaseCut !== sound.releaseCut;
    const octaveChanged = prev.octaveShift !== sound.octaveShift;
    prevRef.current = {
      instrumentId: sound.instrumentId,
      grooveId: sound.grooveId,
      accompanimentPattern: sound.accompanimentPattern,
      accompanimentVariant: sound.accompanimentVariant,
      releaseCut: sound.releaseCut,
      octaveShift: sound.octaveShift,
    };

    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (!instrumentChanged && !grooveChanged && !accompChanged && !releaseCutChanged && !octaveChanged)
      return;

    // Prefer the native transport state — the Groove screen can mount while the
    // editor is already playing and miss the initial 'playing' React state.
    const nativeState = audioService.getState();
    const transportLive = nativeState === 'playing' || nativeState === 'paused';
    void playbackState; // kept in the signature so callers stay in sync with UI

    if (instrumentChanged && !grooveChanged && !accompChanged && !releaseCutChanged && !octaveChanged) {
      if (transportLive) {
        void (async () => {
          try {
            const hot = await audioService.setInstrument(sound.instrumentId);
            if (hot) return;
            // Legacy binary: rebuild at the current beat (no rewind to chord 1).
            const startBeat = audioService.getCurrentBeat();
            await audioService.play({
              ...sessionToPlaybackRequest(sound, loopRef.current, getTier()),
              startBeat,
            });
          } catch (e) {
            logger.error('Instrument live re-apply failed', { error: String(e) });
          }
        })();
        return;
      }
      if (sound.progression.length === 0) return;
      const first = sound.progression[0];
      audioService
        .previewChord(
          chordPreviewRequest(first, sound.key, sound.tempoBpm, sound.instrumentId, sound.octaveShift),
        )
        .catch((e) => logger.error('Instrument preview failed', { error: String(e) }));
      return;
    }

    if (nativeState !== 'playing' || sound.progression.length === 0) return;
    const startBeat = audioService.getCurrentBeat();
    audioService
      .play({
        ...sessionToPlaybackRequest(sound, loopRef.current, getTier()),
        startBeat,
      })
      .catch((e) => logger.error('Audio re-apply failed', { error: String(e) }));
  }, [
    sound.instrumentId,
    sound.grooveId,
    sound.accompanimentPattern,
    sound.accompanimentVariant,
    sound.releaseCut,
    sound.octaveShift,
    playbackState,
  ]);
}
