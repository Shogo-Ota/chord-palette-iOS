/**
 * Rights ledger for teacher MIDI files (docs/midi_dataset_policy.md,
 * docs/midi_sources.md).
 *
 * `docs/style_datasets/midi_registry.json` deserializes into `MidiRegistry`.
 * Every MIDI file gets exactly one entry carrying the full rights record the
 * owner mandated (source, product, purchase, license, per-use permissions,
 * verification status); the ingest pipeline only ever touches entries that are
 * `verified` AND allow derivative use, and never halts on the rest.
 *
 * The chord annotation is MANUAL by design: chord detection from audio/MIDI is
 * a separate, error-prone problem, and a wrong chord frame would corrupt the
 * relativization silently. The curator states what chord the pattern was
 * played over; the pipeline only converts.
 */

import type { AccompanimentStyle, InstrumentRole, RhythmFeel } from '../../model';
import type { PatternSourceType } from '../types';

/** `manual_review_required` = legality unconfirmed → excluded from analysis. */
export type VerificationStatus = 'verified' | 'manual_review_required' | 'rejected';

/** The mandatory acquisition record (docs/midi_sources.md 取得時に記録する情報). */
export interface RightsRecord {
  /** Where it came from (e.g. "Toontrack", "自作"). */
  sourceName: string;
  /** Source URL. Empty allowed only for self-made material. */
  sourceURL: string;
  /** Product name (e.g. 'EZkeys MIDI "Ballads"'). Empty for self-made. */
  productName: string;
  /** ISO date of purchase. Empty for self-made. */
  purchaseDate: string;
  /** License type/identifier (e.g. "Toontrack EULA", "CC0", "自作"). */
  licenseType: string;
  /** What the license permits (e.g. "内部研究・派生パターン作成"). */
  allowedUsage: string;
  /** May the raw MIDI be redistributed? (The pipeline never does either way.) */
  redistributionAllowed: boolean;
  commercialUseAllowed: boolean;
  /** May abstracted/derivative patterns be made? Gates ingestion. */
  derivativeUseAllowed: boolean;
  verificationStatus: VerificationStatus;
  notes?: string;
}

/** The chord frame and metrical context a pattern was recorded over. */
export interface PatternAnnotation {
  /** Root pitch class of the chord (0 = C … 11 = B). */
  rootPc: number;
  /**
   * Chord tones as semitone intervals from the root in root-position order
   * (e.g. maj7 = [0, 4, 7, 11]). Order defines `chordToneIndex`.
   */
  chordIntervals: number[];
  rhythmFeel: RhythmFeel;
  timeSignature: { beatsPerBar: number; beatUnit: number };
  /** Pattern length in bars (pattern length in beats = bars × beatsPerBar). */
  bars: number;
  bpmRange: { min: number; max: number };
  tags: string[];
}

export interface MidiRegistryEntry {
  id: string;
  name: string;
  style: AccompanimentStyle;
  instrumentRole: InstrumentRole;
  /** Coarse class carried onto the LibraryPattern (original/licensed/publicDomain). */
  sourceType: PatternSourceType;
  /** What WE use this material for (e.g. "Ballad hold パターンの研究"). */
  usage: string;
  rights: RightsRecord;
  /** Repo-relative path to the local MIDI file (assets_dev/… — git-ignored). */
  file: string;
  annotation: PatternAnnotation;
  notes?: string;
}

export interface MidiRegistry {
  version: number;
  entries: MidiRegistryEntry[];
}

/**
 * Ledger-level validation. Returns human-readable problems; empty = sound.
 * A `verified` entry with problems must NOT be ingested.
 */
export function registryEntryProblems(e: MidiRegistryEntry): string[] {
  const problems: string[] = [];
  if (!e.id) problems.push('id is empty');
  if (!e.usage) problems.push('usage is empty');
  if (!e.file) problems.push('file path is empty');

  const r = e.rights;
  if (!r) {
    problems.push('rights record is missing (docs/midi_sources.md 取得時に記録する情報)');
  } else {
    if (!r.sourceName) problems.push('rights.sourceName is empty');
    if (!r.licenseType) problems.push('rights.licenseType is empty');
    if (!r.allowedUsage) problems.push('rights.allowedUsage is empty');
    // Self-made material ("自作"/original) may omit URL/product/purchase.
    if (e.sourceType !== 'original') {
      if (!r.sourceURL) problems.push('rights.sourceURL is empty for non-original material');
      if (!r.productName) problems.push('rights.productName is empty for non-original material');
      if (!r.purchaseDate) problems.push('rights.purchaseDate is empty for non-original material');
    }
  }

  const a = e.annotation;
  if (!a) {
    problems.push('annotation is missing');
    return problems;
  }
  if (!Number.isInteger(a.rootPc) || a.rootPc < 0 || a.rootPc > 11) {
    problems.push(`annotation.rootPc ${a.rootPc} outside 0..11`);
  }
  if (!a.chordIntervals.length) problems.push('annotation.chordIntervals is empty');
  if (a.chordIntervals[0] !== 0) problems.push('annotation.chordIntervals must start at 0 (root)');
  if (a.chordIntervals.some((iv) => !Number.isInteger(iv) || iv < 0 || iv > 24)) {
    problems.push('annotation.chordIntervals must be integers within 0..24');
  }
  if (new Set(a.chordIntervals.map((iv) => iv % 12)).size !== a.chordIntervals.length) {
    problems.push('annotation.chordIntervals contain duplicate pitch classes');
  }
  if (a.timeSignature.beatsPerBar <= 0 || a.timeSignature.beatUnit <= 0) {
    problems.push('annotation.timeSignature must be positive');
  }
  if (!Number.isInteger(a.bars) || a.bars <= 0) problems.push('annotation.bars must be >= 1');
  if (a.bpmRange.min <= 0 || a.bpmRange.max < a.bpmRange.min) {
    problems.push('annotation.bpmRange must be positive and ordered');
  }
  return problems;
}

export interface RegistrySelection {
  /** Verified + derivative-use-allowed entries that pass ledger validation. */
  ingestible: MidiRegistryEntry[];
  /** Everything else, with the reason it was skipped (pipeline never halts). */
  skipped: { id: string; reason: string }[];
}

/** Split a registry into what the pipeline may ingest and what it must skip. */
export function selectIngestible(registry: MidiRegistry): RegistrySelection {
  const ingestible: MidiRegistryEntry[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const entry of registry.entries) {
    const status = entry.rights?.verificationStatus;
    if (status !== 'verified') {
      skipped.push({ id: entry.id, reason: `verificationStatus is "${status}"` });
      continue;
    }
    if (!entry.rights.derivativeUseAllowed) {
      skipped.push({
        id: entry.id,
        reason: 'derivativeUseAllowed is false — 内部聴取参考のみ、解析登録不可',
      });
      continue;
    }
    const problems = registryEntryProblems(entry);
    if (problems.length > 0) {
      skipped.push({ id: entry.id, reason: problems.join('; ') });
      continue;
    }
    ingestible.push(entry);
  }
  return { ingestible, skipped };
}
