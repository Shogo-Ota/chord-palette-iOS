/**
 * Maps domain Performance Engine output onto the existing native PlaybackRequest
 * shape (sprint-6 Step 3). Lives in the service layer so the domain stays free of
 * audio/service types.
 *
 * Double-humanize rule (music-supervisor): Perf NoteEvents already fold in
 * microtiming/gate/velocity. We set `accompaniment: 'performance'` so the native
 * engine plays them 1:1 with no grid expansion, sparkle, or extra sway.
 *
 * Drums: PE kick/snare/hat tracks are intentionally dropped here. The native
 * `drumPatternId` groove stays authoritative to avoid double drums until a future
 * step can ingest PE drum events.
 */

import type { NoteEvent as PerfNote } from '@/lib/performance/NoteEvent';
import type { NoteEvent, PlaybackRequest } from '@/services/audio/types';
import type { ChordEvent, MajorKey } from '@/types';

export type PlaybackSessionSnapshot = {
  key: MajorKey;
  tempoBpm: number;
  grooveId: string;
  accompanimentPattern: string;
  instrumentId: string;
  progression: ChordEvent[];
};

/** Deterministic FNV-1a seed from session musical content (same input ⇒ same seed). */
export function performanceSeedFromSession(session: PlaybackSessionSnapshot): number {
  const fingerprint = [
    session.key,
    String(session.tempoBpm),
    session.grooveId,
    session.accompanimentPattern,
    session.instrumentId,
    ...session.progression.map(
      (c) =>
        `${c.rootOffset ?? 0}:${c.suffix ?? ''}:${c.bassOffset ?? ''}:${c.durationBeats}`,
    ),
  ].join('|');

  let hash = 0x811c9dc5;
  for (let i = 0; i < fingerprint.length; i++) {
    hash ^= fingerprint.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Convert Perf notes → PlaybackRequest. Only the pitched voices (chord + optional
 * role-separation `top` + bass) are mapped; PE drum tracks are dropped (native
 * groove is authoritative) and accompaniment is forced to `'performance'` (1:1
 * native passthrough).
 */
export function mapPerfNotesToPlaybackRequest(
  notes: PerfNote[],
  opts: {
    bpm: number;
    totalBeats: number;
    loop: boolean;
    drumPatternId: string;
    instrument: string;
  },
): PlaybackRequest {
  const chordEvents: NoteEvent[] = notes
    .filter((n) => n.trackId === 'chord' || n.trackId === 'top' || n.trackId === 'bass')
    .map((n) => ({
      midiNotes: [n.pitch],
      startBeat: n.timeBeat,
      lengthBeats: Math.max(1 / 64, n.durationBeat),
      velocity: n.velocity,
    }));

  return {
    bpm: opts.bpm,
    totalBeats: opts.totalBeats,
    loop: opts.loop,
    chordEvents,
    drumPatternId: opts.drumPatternId,
    accompaniment: 'performance',
    instrument: opts.instrument,
  };
}
