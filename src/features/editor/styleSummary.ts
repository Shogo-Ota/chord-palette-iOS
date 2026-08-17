/**
 * One readable line describing the current sound: pattern, Type, instrument, drums.
 * Shared by the editor's STYLE chip and the Style screen's audition caption so the
 * two can never disagree about what is playing.
 */

import { INSTRUMENT_LABELS } from '@/data/labels';
import { groupForSelection, typeForSelection } from '@/features/editor/accompanimentGroups';
import { DRUM_BEAT_LABELS, type DrumBeat } from '@/lib/drum/drumBeat';
import { DRUM_MODE_LABELS, type DrumMode } from '@/lib/drum/drumMode';
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
  const group = groupForSelection(s.accompanimentPattern, s.accompanimentVariant);
  const type = typeForSelection(s.accompanimentPattern, s.accompanimentVariant);
  const parts = [group.label];
  // A group with a single real take has no Type to show.
  if ((group.types.length > 1 || group.id === 'variation') && type) {
    parts.push(type.label);
  }
  parts.push(INSTRUMENT_LABELS[s.instrumentId], drumSummaryText(s.drumMode, s.drumBeat));
  return parts;
}

export function styleSummaryText(s: StyleSummaryInput, separator = ' / '): string {
  return styleSummaryParts(s).join(separator);
}
