/**
 * Chord → MIDI voicing (pure, UI-independent). Turns the degree-based chord data
 * carried on every {@link ChordEvent} (`rootOffset` semitones above the tonic +
 * quality `suffix`, plus an optional slash `bassOffset`) into concrete MIDI note
 * numbers for the audio engine. Kept out of the native layer so the engine only
 * ever receives a generic list of notes (sprint-2.md §2).
 */

import { keyTonicPc } from '@/data/music';
import { voiceLeadProgression, type VoiceLeadingOptions } from '@/lib/performance/voiceLeading';
import { intervalsForChord } from '@/lib/theory/definitions';
import { refineBodyVoicing } from '@/lib/voicingColor';
import type { ChordSpec } from '@/services/audio/schedule';
import type { ChordEvent, MajorKey } from '@/types';

/** Register for chord roots (C3). Keeps triads/7ths in a comfortable mid band. */
const CHORD_ROOT_MIDI = 48;
/** Upper bass fundamental (C2), an octave below the chord body. */
const BASS_ROOT_MIDI = 36;

/** The chord fields that determine which semitones it spells. */
type ChordQualityRef = Pick<ChordEvent, 'suffix' | 'definitionId'>;

/**
 * Which semitones a chord spells, resolved through the Theory Engine catalog
 * (`@/lib/theory/definitions`) rather than a table kept here — the catalog is the
 * single source so a quality is defined once. Events carrying a `definitionId`
 * resolve by id; older ones fall back to their `suffix`.
 */
function intervalsFor(chord: ChordQualityRef): number[] {
  return intervalsForChord(chord.suffix ?? '', chord.definitionId);
}

function pitchClass(n: number): number {
  return ((n % 12) + 12) % 12;
}

/**
 * Split a chord into its fixed bass octaves and its (root-position) body. Extracted
 * so both the context-free {@link chordMidiNotes} and the progression-level
 * {@link progressionToChordSpecs} share one definition — the latter needs the body
 * on its own to apply voice leading while keeping the bass anchored. This is a pure
 * refactor: {@link chordMidiNotes} concatenates the exact same notes as before.
 */
function chordVoicingParts(
  chord: Pick<ChordEvent, 'rootOffset' | 'suffix' | 'definitionId' | 'bassOffset'>,
  key: MajorKey,
): { bass: number[]; body: number[] } {
  const tonic = keyTonicPc(key);
  const rootMidi = CHORD_ROOT_MIDI + pitchClass(tonic + (chord.rootOffset ?? 0));
  const body = intervalsFor(chord).map((iv) => rootMidi + iv);

  // Slash chords put their explicit bass in the low octaves; otherwise the root.
  // Audit P0-2: drop the always-on C1 sub-bass stack — it muddies headphones and
  // is inaudible on iPhone speakers while eating headroom. Keep C2 only; C1 may
  // return later as a conditional/attenuated layer.
  const bassPc = pitchClass(tonic + (chord.bassOffset ?? chord.rootOffset ?? 0));
  const bass = [BASS_ROOT_MIDI + bassPc];

  return { bass, body };
}

/**
 * Root-position chord tones for arpeggiation, ascending from the chord root
 * (root, 3rd, 5th, 7th, then any tensions 9/11/13). Unlike the voice-led,
 * rootless {@link progressionToChordSpecs} body, this KEEPS the root and the full
 * stack so an arpeggio can spell 1-3-5-7 (and 1-3-5-7-9-13 with tensions)
 * predictably — the shape stays the same whether or not tensions are present.
 * Fixed C3-band register; deliberately ignores voice leading and the slash bass
 * (the arpeggio spells the chord from its own root; the bass track keeps the slash
 * note). Pure and context-free.
 */
export function chordArpeggioNotes(
  chord: Pick<ChordEvent, 'rootOffset' | 'suffix' | 'definitionId'>,
  key: MajorKey,
): number[] {
  const tonic = keyTonicPc(key);
  const rootMidi = CHORD_ROOT_MIDI + pitchClass(tonic + (chord.rootOffset ?? 0));
  return intervalsFor(chord).map((iv) => rootMidi + iv);
}

/**
 * Concrete MIDI notes for a chord in the given key. Every chord is anchored by a
 * C2-band bass fundamental (chord root, or slash bass when present). The former
 * always-on C1 sub-bass doubling was removed (music-supervisor audit P0-2). The
 * chord body sits in the C3 band. Bass notes come first (lowest → highest).
 *
 * Context-free by design (no previous chord) so it stays correct for single-chord
 * previews and the keyboard visual. Progression-level voice leading is applied in
 * {@link progressionToChordSpecs}.
 *
 * `octaveShift` (in octaves, default 0) transposes the WHOLE result up/down so the
 * user's device-level register preference (bass floor C2 vs C3) applies uniformly
 * to preview, keyboard visual and export — the bass stays an octave below the body
 * either way, so slash-chord bass ordering is preserved.
 */
export function chordMidiNotes(
  chord: Pick<ChordEvent, 'rootOffset' | 'suffix' | 'definitionId' | 'bassOffset'>,
  key: MajorKey,
  octaveShift = 0,
): number[] {
  const { bass, body } = chordVoicingParts(chord, key);
  const semis = 12 * octaveShift;
  return [...bass, ...body].map((n) => n + semis);
}

/**
 * Map a progression to the ChordSpec list consumed by the scheduler, applying
 * basic voice leading (requirements §5.5 / sprint-6 §4 Step 1). The bass octaves
 * stay anchored on each chord's root/slash note; only the mid-register body is
 * re-voiced so consecutive chords hold common tones and move by the smallest
 * distance instead of every chord snapping back to root position. The output shape
 * (bass first, then body) is unchanged, so downstream consumers (scheduler, video
 * export) are unaffected. Voice leading is delegated to the pure
 * `performance/voiceLeading` module (RN/Expo-independent, unit-tested).
 *
 * Chord quality is exactly the user's chosen suffix — no automatic add9 / 7th /
 * sus / tension. Arrangement color (add9, sus4, …) stays a deliberate UX choice.
 * Playback polish here is layout only: {@link refineBodyVoicing} (rootless/open
 * within the chosen tones, since the bass already owns the root). Groove/feel
 * lives in the Performance Engine rhythm layer, not in extra chord tones.
 *
 * `options` selects the voicing aesthetic (inversion/octave placement). Omitted =
 * the engine default (`balanced`), which reproduces the current output exactly — so
 * every existing caller is unaffected. See `VOICING_AESTHETICS`.
 */
export function progressionToChordSpecs(
  progression: ChordEvent[],
  key: MajorKey,
  options?: VoiceLeadingOptions,
): ChordSpec[] {
  const tonic = keyTonicPc(key);
  const parts = progression.map((e) => {
    const { bass, body } = chordVoicingParts(e, key);
    const rootPc = pitchClass(tonic + (e.rootOffset ?? 0));
    return { bass, body: refineBodyVoicing(body, rootPc) };
  });
  const ledBodies = options
    ? voiceLeadProgression(parts.map((p) => p.body), options)
    : voiceLeadProgression(parts.map((p) => p.body));
  return progression.map((e, i) => ({
    midiNotes: [...parts[i].bass, ...ledBodies[i]],
    lengthBeats: e.durationBeats,
  }));
}
