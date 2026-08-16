/**
 * The Golden Progressions the quality harnesses render. The corpus itself lives in
 * `src/lib/midiQa/goldenProgressions.ts` so the permanent contract tests and these
 * offline harnesses can never drift onto different chords.
 */

export {
  GOLDEN_PROGRESSIONS,
  goldenProgressionById,
  type GoldenProgression,
  type GoldenProgressionId,
} from '@/lib/midiQa/goldenProgressions';
