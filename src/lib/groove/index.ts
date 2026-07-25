export type {
  ChordTimelineEvent,
  CompStroke,
  DrumHit,
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
export { compilePianoStrikes, gridOnsetBeats } from '@/lib/groove/compilePiano';
export {
  grooveProfileFor,
  PRODUCT_GROOVE_IDS,
  PRODUCT_ACCOMPANIMENT_IDS,
} from '@/lib/groove/profiles';
