/**
 * SMF → LibraryPattern relativization (docs/midi_dataset_policy.md).
 *
 * Converts parsed teacher MIDI into the fully relative registration format:
 * beat position, chord-tone index against the MANUALLY annotated chord frame,
 * octave offset from the instrument role's home register, velocity ratio and
 * beat duration. The raw MIDI never leaves this function — only the relative
 * pattern (which transplants onto any key/chord) is kept (policy rule 3).
 *
 * v1 limitation, on purpose: `RelativeNote` cannot express a non-chord tone,
 * so NCTs are EXCLUDED and counted in the report instead of being bent onto
 * the nearest chord tone (which would falsify the pattern). Same for notes
 * outside the annotated pattern length.
 */

import type { LibraryPattern, ProfileSummary, RelativeNote } from '../types';
import { validateLibraryPattern } from '../validate';
import type { InstrumentRole } from '../../model';
import type { MidiRegistryEntry } from './registry';
import type { SmfSong } from './smf';

/**
 * Home register per role: the MIDI note that anchors `octaveOffset = 0`
 * (chord tones realize inside [home, home+12)). Values mirror the registers
 * the Performance Engine already writes to for each track.
 */
export const HOME_REGISTER: Partial<Record<InstrumentRole, number>> = {
  piano: 60, // C4 — right-hand comping center
  bass: 36, // C2 — engine bass register
  guitar: 48, // C3
  strings: 60, // C4
  // drums: percussion is slot-based, not chord-relative — not ingestible in v1.
};

export interface IngestReport {
  entryId: string;
  notesInFile: number;
  notesIngested: number;
  /** Notes whose pitch class is not in the annotated chord (excluded). */
  nonChordTonesExcluded: number;
  /** Notes starting at/after the annotated pattern length (excluded). */
  outsideLengthExcluded: number;
  /** Notes whose octave offset exceeds ±3 (excluded; register outlier). */
  registerOutliersExcluded: number;
  /** Parser + converter warnings, and validator problems if any. */
  warnings: string[];
  problems: string[];
}

export interface IngestResult {
  /** null when the conversion produced nothing valid (see report.problems). */
  pattern: LibraryPattern | null;
  report: IngestReport;
}

function summarize(values: number[]): ProfileSummary {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

/** Realization of `pc` inside [home, home + 12). */
function pitchClassInHomeOctave(pc: number, home: number): number {
  return home + ((pc - (home % 12) + 12) % 12);
}

/**
 * Convert one parsed SMF against its ledger entry. Pure; never throws for
 * musical content — every exclusion is counted in the report (policy rule 6).
 */
export function relativizeSmf(
  song: SmfSong,
  entry: MidiRegistryEntry,
  now: () => string = () => new Date().toISOString(),
): IngestResult {
  const a = entry.annotation;
  const report: IngestReport = {
    entryId: entry.id,
    notesInFile: song.notes.length,
    notesIngested: 0,
    nonChordTonesExcluded: 0,
    outsideLengthExcluded: 0,
    registerOutliersExcluded: 0,
    warnings: [...song.warnings],
    problems: [],
  };

  const home = HOME_REGISTER[entry.instrumentRole];
  if (home === undefined) {
    report.problems.push(
      `instrumentRole "${entry.instrumentRole}" is not chord-relative — not ingestible in v1`,
    );
    return { pattern: null, report };
  }

  const patternLengthBeats = a.bars * a.timeSignature.beatsPerBar;
  const chordPcs = a.chordIntervals.map((iv) => (a.rootPc + iv) % 12);
  const peakVelocity = Math.max(...song.notes.map((n) => n.velocity), 1);

  const notes: RelativeNote[] = [];
  for (const n of song.notes) {
    const posBeats = n.tick / song.ppq;
    if (posBeats >= patternLengthBeats) {
      report.outsideLengthExcluded += 1;
      continue;
    }
    const toneIndex = chordPcs.indexOf(n.pitch % 12);
    if (toneIndex < 0) {
      report.nonChordTonesExcluded += 1;
      continue;
    }
    const tonePitchHome = pitchClassInHomeOctave(chordPcs[toneIndex], home);
    const octaveOffset = Math.round((n.pitch - tonePitchHome) / 12);
    if (Math.abs(octaveOffset) > 3) {
      report.registerOutliersExcluded += 1;
      continue;
    }
    notes.push({
      posBeats,
      chordToneIndex: toneIndex,
      octaveOffset,
      velocityRatio: Math.min(1, n.velocity / peakVelocity),
      durationBeats: n.durTicks / song.ppq,
    });
  }
  report.notesIngested = notes.length;
  if (notes.length === 0) {
    report.problems.push('no ingestible notes (all excluded or file empty)');
    return { pattern: null, report };
  }

  // Per-beat accent = the loudest onset in that beat (0 where nothing starts).
  const accentMap = Array.from({ length: Math.ceil(patternLengthBeats) }, () => 0);
  for (const n of notes) {
    const beat = Math.floor(n.posBeats);
    accentMap[beat] = Math.max(accentMap[beat], n.velocityRatio);
  }

  const timestamp = now();
  const r = entry.rights;
  const provenance = [r.sourceName, r.productName].filter(Boolean).join(' ');
  const pattern: LibraryPattern = {
    id: entry.id,
    name: entry.name,
    sourceType: entry.sourceType,
    license: `${r.licenseType} — ${provenance}`,
    style: entry.style,
    rhythmFeel: a.rhythmFeel,
    timeSignature: { ...a.timeSignature },
    bpmRange: { ...a.bpmRange },
    instrumentRole: entry.instrumentRole,
    patternLengthBeats,
    notes,
    velocityProfile: summarize(notes.map((n) => n.velocityRatio)),
    durationProfile: summarize(notes.map((n) => n.durationBeats)),
    accentMap,
    tags: [...a.tags],
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };

  report.problems.push(...validateLibraryPattern(pattern));
  return report.problems.length > 0 ? { pattern: null, report } : { pattern, report };
}
