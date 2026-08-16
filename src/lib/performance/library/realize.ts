/**
 * Realize a LibraryPattern onto a user chord progression → NoteEvent[].
 *
 * Domain-only: no RN / Expo / native. Does not invent non-chord tones.
 * Voice-leading hint: when preferCommonTones, octaveOffset is nudged so each
 * chord-tone role stays near the previous absolute pitch (common-tone bias).
 */

import { clampVelocity, type NoteEvent, type TrackId } from '../NoteEvent';
import { HOME_REGISTER } from './ingest/relativize';
import type { LibraryPattern, RelativeNote } from './types';

/** Minimal chord frame needed for realize (matches PerfChord fields we use). */
export interface RealizeChord {
  bodyMidi: number[];
  bassMidi: number[];
  /** Root-position ascending tones when available (preferred for chordToneIndex). */
  arpMidi?: number[];
  startBeat: number;
  durationBeats: number;
}

export interface RealizeOptions {
  seed: number;
  /** MIDI velocity peak for ratio=1. Default 80. */
  velocityCenter?: number;
  /** Override track (default: piano→chord, bass→bass). */
  trackId?: TrackId;
}

function rootPc(chord: RealizeChord): number {
  if (chord.arpMidi && chord.arpMidi.length > 0) return chord.arpMidi[0] % 12;
  if (chord.bodyMidi.length > 0) return Math.min(...chord.bodyMidi.map((p) => p % 12));
  if (chord.bassMidi.length > 0) return chord.bassMidi[0] % 12;
  return 0;
}

/** Root-position tone list for chordToneIndex lookup. */
function toneLadder(chord: RealizeChord): number[] {
  if (chord.arpMidi && chord.arpMidi.length > 0) return [...chord.arpMidi];
  if (chord.bodyMidi.length === 0) {
    return chord.bassMidi.length > 0 ? [chord.bassMidi[0]] : [];
  }
  const root = rootPc(chord);
  return [...chord.bodyMidi].sort((a, b) => {
    const ia = (a % 12 - root + 12) % 12;
    const ib = (b % 12 - root + 12) % 12;
    return ia - ib || a - b;
  });
}

function pitchForTone(
  ladder: number[],
  chordToneIndex: number,
  octaveOffset: number,
  home: number,
): number | undefined {
  if (ladder.length === 0) return undefined;
  const base = ladder[chordToneIndex % ladder.length];
  let pitch = base;
  while (pitch < home - 6) pitch += 12;
  while (pitch >= home + 6) pitch -= 12;
  pitch += octaveOffset * 12;
  return Math.max(0, Math.min(127, pitch));
}

function notesForBar(pattern: LibraryPattern, barInPhrase: number): RelativeNote[] {
  const pv = pattern.phraseVariation;
  if (pv && pv.barInPhrase === barInPhrase && pv.notes.length > 0) return pv.notes;
  return pattern.notes;
}

function defaultTrack(pattern: LibraryPattern): TrackId {
  return pattern.instrumentRole === 'bass' ? 'bass' : 'chord';
}

function choosePitch(
  ladder: number[],
  n: RelativeNote,
  home: number,
  preferCommon: boolean,
  prevByRole: Map<number, number>,
): number | undefined {
  let octave = n.octaveOffset;
  let pitch = pitchForTone(ladder, n.chordToneIndex, octave, home);
  if (pitch === undefined) return undefined;

  if (preferCommon) {
    const prev = prevByRole.get(n.chordToneIndex);
    if (prev !== undefined) {
      let best = pitch;
      let bestDist = Math.abs(pitch - prev);
      for (const candOct of [octave - 1, octave, octave + 1]) {
        if (Math.abs(candOct) > 3) continue;
        const cand = pitchForTone(ladder, n.chordToneIndex, candOct, home);
        if (cand === undefined) continue;
        const d = Math.abs(cand - prev);
        if (d < bestDist) {
          bestDist = d;
          best = cand;
        }
      }
      pitch = best;
    }
  }
  return pitch;
}

/**
 * Map a relative pattern across `chords`. Pattern loops by `patternLengthBeats`
 * within each chord span; phraseVariation swaps notes on the configured phrase bar.
 */
export function realizeLibraryPattern(
  pattern: LibraryPattern,
  chords: RealizeChord[],
  options: RealizeOptions,
): NoteEvent[] {
  if (chords.length === 0 || pattern.notes.length === 0) return [];

  const home = HOME_REGISTER[pattern.instrumentRole] ?? 60;
  const velocityCenter = options.velocityCenter ?? 80;
  const trackId = options.trackId ?? defaultTrack(pattern);
  const preferCommon = pattern.progressionHints?.preferCommonTones === true;
  const topMaxStep = pattern.progressionHints?.topVoiceMaxStep;
  const beatsPerBar = pattern.timeSignature.beatsPerBar;
  const loopLen = pattern.patternLengthBeats;

  const events: NoteEvent[] = [];
  const prevByRole = new Map<number, number>();
  let prevTop: number | undefined;

  for (const chord of chords) {
    const ladder = toneLadder(chord);
    if (ladder.length === 0) continue;
    const chordEnd = chord.startBeat + chord.durationBeats;

    for (let offset = 0; offset < chord.durationBeats - 1e-9; offset += loopLen) {
      const loopStart = chord.startBeat + offset;
      const barIndex = Math.floor(loopStart / beatsPerBar + 1e-9);
      const barInPhrase = ((barIndex % 4) + 4) % 4;
      const slice = notesForBar(pattern, barInPhrase);

      let onsetTop: number | undefined;

      for (const n of slice) {
        const absPos = loopStart + n.posBeats;
        if (absPos < chord.startBeat - 1e-9 || absPos >= chordEnd - 1e-9) continue;

        let pitch = choosePitch(ladder, n, home, preferCommon, prevByRole);
        if (pitch === undefined) continue;

        prevByRole.set(n.chordToneIndex, pitch);
        if (onsetTop === undefined || pitch > onsetTop) onsetTop = pitch;

        const dur = Math.min(n.durationBeats, chordEnd - absPos);
        if (dur <= 0) continue;

        events.push({
          timeBeat: absPos,
          durationBeat: dur,
          pitch,
          velocity: clampVelocity(velocityCenter * n.velocityRatio),
          articulation: n.articulation ?? 'normal',
          rrIndex: 0,
          trackId,
          seed: options.seed,
        });
      }

      if (onsetTop !== undefined && topMaxStep !== undefined && prevTop !== undefined) {
        if (Math.abs(onsetTop - prevTop) > topMaxStep) {
          const shift = onsetTop > prevTop ? -12 : 12;
          // Shift the notes we just added for this loop if leap is too wide.
          for (let i = events.length - 1; i >= 0; i--) {
            const e = events[i];
            if (e.timeBeat < loopStart - 1e-9) break;
            if (e.trackId !== trackId) continue;
            e.pitch = Math.max(0, Math.min(127, e.pitch + shift));
          }
          onsetTop += shift;
        }
      }
      if (onsetTop !== undefined) prevTop = onsetTop;
    }
  }

  events.sort((a, b) => a.timeBeat - b.timeBeat || a.pitch - b.pitch);
  return events;
}
