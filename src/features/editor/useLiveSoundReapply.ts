import { useEffect, useRef } from 'react';

import { beatsPerBarFor, chordPreviewRequest, sessionToPlaybackRequest } from '@/features/editor/playback';
import type { EditorSession } from '@/features/editor/session';
import { rescaleBeats } from '@/lib/performance/meter';
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
 * The `sound` argument is the source of truth. On the Groove screen this is
 * the committed session — style taps write through immediately.
 *
 * Instrument-only: prefer native hot-swap (`setInstrument`). If the installed
 * binary lacks it, rebuild via `play` at the current beat so the playhead does
 * not jump to the first chord. Groove / accompaniment / releaseCut always
 * rebuild the note plan.
 */
/**
 * Everything except the instrument that changes the rendered note plan. Kept as one
 * string so a new sound control (drum subdivision, instrument effect, …) joins the
 * live re-apply by being listed here once.
 */
function planSignature(s: EditorSession): string {
  return [
    s.grooveId,
    s.accompanimentPattern,
    s.accompanimentVariant,
    s.accompanimentEnergy,
    s.releaseCut,
    s.instrumentEffect,
    s.octaveShift,
    s.drumMode,
    s.drumBeat,
  ].join('|');
}

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
    accompanimentPattern: sound.accompanimentPattern,
    plan: planSignature(sound),
  });

  useEffect(() => {
    const prev = prevRef.current;
    const instrumentChanged = prev.instrumentId !== sound.instrumentId;
    const planChanged = prev.plan !== planSignature(sound);
    prevRef.current = {
      instrumentId: sound.instrumentId,
      accompanimentPattern: sound.accompanimentPattern,
      plan: planSignature(sound),
    };

    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (!instrumentChanged && !planChanged) return;

    // Prefer the native transport state — the Groove screen can mount while the
    // editor is already playing and miss the initial 'playing' React state.
    const nativeState = audioService.getState();
    const transportLive = nativeState === 'playing' || nativeState === 'paused';
    void playbackState; // kept in the signature so callers stay in sync with UI

    if (instrumentChanged && !planChanged) {
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
    // The playhead is counted in the OLD rhythm's beats. A waltz or 6/8 bar is not
    // four beats long, so carrying the raw number into the new plan would fold it to
    // a different chord; rescale it to keep the same place in the progression.
    const startBeat = rescaleBeats(
      audioService.getCurrentBeat(),
      beatsPerBarFor(prev.accompanimentPattern),
      beatsPerBarFor(sound.accompanimentPattern),
    );
    audioService
      .play({
        ...sessionToPlaybackRequest(sound, loopRef.current, getTier()),
        startBeat,
      })
      .catch((e) => logger.error('Audio re-apply failed', { error: String(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound.instrumentId, planSignature(sound), playbackState]);
}
