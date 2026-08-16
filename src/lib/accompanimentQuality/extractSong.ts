/**
 * Offline: piano notes + CL chord-track notes → transition features.
 * No filesystem. Production realize is not called.
 */

import { spansFromChordNotes, type ChordNote } from './pop909Chords';
import {
  extractTransitionFeatures,
  groupAttacks,
  primaryVoicing,
} from './popVoicingFeatures';
import type { SmfDetailed } from './smfDetailed';
import { notesOnTrack } from './smfDetailed';
import type { TransitionFeatures } from './types';

export function findNamedTrack(song: SmfDetailed, pattern: RegExp): number {
  return song.trackNames.findIndex((name) => pattern.test(name ?? ''));
}

/** README: PIANO is the accompaniment. No pitch-based fallback. */
export function findPianoTrack(song: SmfDetailed): number {
  const exact = findNamedTrack(song, /^piano$/i);
  if (exact >= 0) return exact;
  return findNamedTrack(song, /piano/i);
}

/** POP909-CL: last note-bearing track is the human-corrected chord stack. */
export function findChordTrack(song: SmfDetailed): number {
  for (let i = song.trackCount - 1; i >= 0; i -= 1) {
    if (notesOnTrack(song, i).length > 0) return i;
  }
  return -1;
}

export function extractTransitionsFromSong(input: {
  piano: SmfDetailed;
  pianoTrack: number;
  chords: SmfDetailed;
  chordTrack: number;
}): { transitions: TransitionFeatures[]; excludedReason: string | null } {
  const pianoNotes = notesOnTrack(input.piano, input.pianoTrack);
  const chordNotes = notesOnTrack(input.chords, input.chordTrack);
  if (pianoNotes.length === 0) return { transitions: [], excludedReason: 'empty_piano_track' };
  if (chordNotes.length === 0) return { transitions: [], excludedReason: 'empty_chord_track' };

  const songEnd = Math.max(
    ...pianoNotes.map((n) => n.tick + n.durTicks),
    ...chordNotes.map((n) => n.tick + n.durTicks),
  );
  const mapped: ChordNote[] = chordNotes.map((n) => ({
    tick: n.tick,
    pitch: n.pitch,
    durTicks: n.durTicks,
  }));
  const spans = spansFromChordNotes(mapped, input.chords.ppq, songEnd);
  if (spans.length < 2) return { transitions: [], excludedReason: 'fewer_than_two_chords' };

  const pianoBeats = pianoNotes.map((n) => ({
    startBeat: n.tick / input.piano.ppq,
    pitch: n.pitch,
  }));

  const primaries: Array<{
    span: (typeof spans)[number];
    voicing: NonNullable<ReturnType<typeof primaryVoicing>>;
    groups: number;
    notes: number;
  }> = [];

  for (const span of spans) {
    const inSpan = pianoBeats.filter(
      (n) => n.startBeat >= span.startBeat - 1e-6 && n.startBeat < span.endBeat - 1e-6,
    );
    const groups = groupAttacks(inSpan);
    const primary = primaryVoicing(groups.filter((g) => g.pitches.length >= 2) ) ?? primaryVoicing(groups);
    if (!primary || primary.pitches.length < 2) continue;
    primaries.push({
      span,
      voicing: primary,
      groups: groups.length,
      notes: inSpan.length,
    });
  }

  if (primaries.length < 2) return { transitions: [], excludedReason: 'fewer_than_two_voicings' };

  const transitions: TransitionFeatures[] = [];
  for (let i = 1; i < primaries.length; i += 1) {
    const prev = primaries[i - 1];
    const next = primaries[i];
    transitions.push(
      extractTransitionFeatures({
        prev: prev.voicing,
        next: next.voicing,
        prevChord: prev.span,
        nextChord: next.span,
        attackGroupsInNext: next.groups,
        notesInNextSpan: next.notes,
        spanBeats: next.span.endBeat - next.span.startBeat,
      }),
    );
  }
  return { transitions, excludedReason: null };
}
