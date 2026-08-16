/**
 * One readable line describing the current sound: pattern, Type, instrument, drums.
 * Shared by the editor's STYLE chip and the Style screen's audition caption so the
 * two can never disagree about what is playing.
 */

import { ACCOMPANIMENT_LABELS, INSTRUMENT_LABELS } from '@/data/labels';
import { DRUM_BEAT_LABELS, type DrumBeat } from '@/lib/drum/drumBeat';
import { DRUM_MODE_LABELS, type DrumMode } from '@/lib/drum/drumMode';
import { offeredVariantsFor, resolveVariant } from '@/lib/performance/variants';
import type { AccompanimentPattern, InstrumentId } from '@/types';

export type StyleSummaryInput = {
  accompanimentPattern: AccompanimentPattern;
  accompanimentVariant?: string;
  instrumentId: InstrumentId;
  drumMode: DrumMode;
  drumBeat: DrumBeat;
};

/** Drums as the user set them: "ドラムなし" / "クラップ" / "フル 8ビート". */
export function drumSummaryText(drumMode: DrumMode, drumBeat: DrumBeat): string {
  if (drumMode === 'off') return 'ドラムなし';
  if (drumMode === 'clap') return DRUM_MODE_LABELS.clap;
  return `${DRUM_MODE_LABELS[drumMode]} ${DRUM_BEAT_LABELS[drumBeat]}`;
}

export function styleSummaryParts(s: StyleSummaryInput): string[] {
  const parts = [ACCOMPANIMENT_LABELS[s.accompanimentPattern]];
  // A pattern with a single real take has no Type to show.
  if (offeredVariantsFor(s.accompanimentPattern).length > 1) {
    parts.push(resolveVariant(s.accompanimentPattern, s.accompanimentVariant).label);
  }
  parts.push(INSTRUMENT_LABELS[s.instrumentId], drumSummaryText(s.drumMode, s.drumBeat));
  return parts;
}

export function styleSummaryText(s: StyleSummaryInput, separator = ' / '): string {
  return styleSummaryParts(s).join(separator);
}
