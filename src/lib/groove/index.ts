export type {
  BeatStrike,
  ChordTimelineEvent,
  CompStroke,
  DrumHit,
  DrumHitPayload,
  DrumPatternDoc,
  DrumVoice,
  GrooveFeatures,
  GrooveProfile,
  GrooveSource,
  NoteStrike,
  PedalStyle,
  PianoCompileInput,
  PianoGridLayer,
  PianoPart,
  PianoPatternDoc,
} from '@/lib/groove/types';

export { humanizeGain, timingSway } from '@/lib/groove/humanize';
export { DRUM_PATTERNS, getDrumPattern } from '@/lib/groove/drumPatterns';
export { PIANO_PATTERNS, getPianoPattern } from '@/lib/groove/pianoPatterns';
export { BASS_PATTERNS, getBassPattern } from '@/lib/groove/bassPatterns';
export type { BassPatternDoc, BassPatternId } from '@/lib/groove/bassPatterns';
export {
  applySwingToBeat,
  beatStrikesToFrames,
  compilePianoBeatStrikes,
  compilePianoStrikes,
  framesPerBeat,
  gridOnsetBeats,
} from '@/lib/groove/compilePiano';
export {
  grooveProfileFor,
  PRODUCT_GROOVE_IDS,
  PRODUCT_ACCOMPANIMENT_IDS,
} from '@/lib/groove/profiles';
export { buildChordStrikesPayload, buildDrumHitsPayload } from '@/lib/groove/attachStrikes';
