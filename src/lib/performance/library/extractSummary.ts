/**
 * Derive whitelist extract fields from a LibraryPattern for ingest verification.
 * Does not invent section / energy / emotion / genre labels.
 */

import type { LibraryPattern, RelativeNote } from './types';

export interface PatternExtractSummary {
  bpmRange: { min: number; max: number };
  meter: { beatsPerBar: number; beatUnit: number };
  patternLengthBeats: number;
  onsetCount: number;
  uniqueOnsets: number[];
  /** Beats (0..ceil(length)-1) with no onset — rests by absence. */
  restBeats: number[];
  maxPolyphony: number;
  meanDurationBeats: number;
  meanVelocityRatio: number;
  chordToneRoles: number[];
  arpeggioOrders: number[][];
  hasPhraseVariation: boolean;
  progressionHints: LibraryPattern['progressionHints'];
}

function groupByOnset(notes: RelativeNote[]): Map<number, RelativeNote[]> {
  const map = new Map<number, RelativeNote[]>();
  for (const n of notes) {
    const key = Math.round(n.posBeats * 1000) / 1000;
    const list = map.get(key) ?? [];
    list.push(n);
    map.set(key, list);
  }
  return map;
}

/** Summarize whitelist fields already present on a relative pattern. */
export function extractPatternSummary(pattern: LibraryPattern): PatternExtractSummary {
  const notes = pattern.notes;
  const byOnset = groupByOnset(notes);
  const uniqueOnsets = [...byOnset.keys()].sort((a, b) => a - b);
  const beatCount = Math.ceil(pattern.patternLengthBeats);
  const onsetBeats = new Set(uniqueOnsets.map((p) => Math.floor(p)));
  const restBeats: number[] = [];
  for (let b = 0; b < beatCount; b++) {
    if (!onsetBeats.has(b)) restBeats.push(b);
  }
  let maxPolyphony = 0;
  const arpeggioOrders: number[][] = [];
  for (const pos of uniqueOnsets) {
    const group = byOnset.get(pos) ?? [];
    maxPolyphony = Math.max(maxPolyphony, group.length);
    arpeggioOrders.push(group.map((n) => n.chordToneIndex));
  }
  const meanDurationBeats =
    notes.reduce((s, n) => s + n.durationBeats, 0) / Math.max(1, notes.length);
  const meanVelocityRatio =
    notes.reduce((s, n) => s + n.velocityRatio, 0) / Math.max(1, notes.length);

  return {
    bpmRange: { ...pattern.bpmRange },
    meter: { ...pattern.timeSignature },
    patternLengthBeats: pattern.patternLengthBeats,
    onsetCount: notes.length,
    uniqueOnsets,
    restBeats,
    maxPolyphony,
    meanDurationBeats,
    meanVelocityRatio,
    chordToneRoles: [...new Set(notes.map((n) => n.chordToneIndex))].sort((a, b) => a - b),
    arpeggioOrders,
    hasPhraseVariation: Boolean(pattern.phraseVariation?.notes.length),
    progressionHints: pattern.progressionHints,
  };
}
