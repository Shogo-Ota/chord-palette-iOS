/**
 * Post-export validation: Final MIDI snapshot must match playback plan invariants.
 */

import { parseSmf } from '@/lib/performance/library/ingest/smf';
import { writeSmf, DEFAULT_PPQ } from './smfWrite';
import { playbackAccompanimentNotes } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import type {
  FinalMidiSnapshot,
  FinalMidiValidationResult,
  SessionPerformancePlan,
} from '@/lib/performance/finalMidi/types';

function nearly(a: number, b: number, eps = 1e-4): boolean {
  return Math.abs(a - b) <= eps;
}

function noteKey(n: { startBeat: number; pitch: number; velocity: number; durationBeat: number }): string {
  return `${n.startBeat.toFixed(6)}:${n.pitch}:${n.velocity}:${n.durationBeat.toFixed(6)}`;
}

export function validateFinalMidiSnapshot(
  snapshot: FinalMidiSnapshot,
  plan: SessionPerformancePlan,
): FinalMidiValidationResult {
  const errors: string[] = [];
  const playbackNotes = playbackAccompanimentNotes(plan);
  const exportNotes = snapshot.notes.filter((n) => n.track === 'accompaniment');

  if (exportNotes.length !== playbackNotes.length) {
    errors.push(`note count mismatch: export=${exportNotes.length} playback=${playbackNotes.length}`);
  }

  const playbackKeys = playbackNotes.map(noteKey).sort();
  const exportKeys = exportNotes.map(noteKey).sort();
  if (playbackKeys.join('|') !== exportKeys.join('|')) {
    errors.push('pitch/velocity/timing mismatch between export and playback accompaniment notes');
  }

  for (const n of snapshot.notes) {
    if (!Number.isFinite(n.pitch) || n.pitch < 1 || n.pitch > 127) {
      errors.push(`illegal pitch ${n.pitch} at beat ${n.startBeat}`);
    }
    if (!Number.isFinite(n.velocity) || n.velocity < 1 || n.velocity > 127) {
      errors.push(`illegal velocity ${n.velocity} at beat ${n.startBeat}`);
    }
  }

  for (const cc of snapshot.controlChanges) {
    if (cc.controller !== 64) {
      errors.push(`unexpected CC controller ${cc.controller}`);
    }
    if (cc.value < 0 || cc.value > 127) {
      errors.push(`illegal CC64 value ${cc.value}`);
    }
  }

  for (let i = 0; i < plan.progression.length; i++) {
    const expected = plan.progression[i]!.displayName;
    const expectedBeat = plan.chords[i]?.startBeat ?? 0;
    const marker = snapshot.markers[i];
    if (!marker) {
      errors.push(`missing chord marker at index ${i}`);
    } else {
      if (!nearly(marker.startBeat, expectedBeat)) {
        errors.push(`marker beat mismatch for ${expected}: ${marker.startBeat} vs ${expectedBeat}`);
      }
      if (marker.label !== expected) {
        errors.push(`marker label mismatch: ${marker.label} vs ${expected}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Round-trip SMF parse smoke test + structural checks. */
export function validateSmfBytes(snapshot: FinalMidiSnapshot): FinalMidiValidationResult {
  const errors: string[] = [];
  try {
    const bytes = writeSmf(snapshot);
    const song = parseSmf(bytes);
    if (song.format !== 1) errors.push(`expected format 1, got ${song.format}`);
    if (song.ppq !== DEFAULT_PPQ) errors.push(`expected ppq ${DEFAULT_PPQ}, got ${song.ppq}`);
    if (song.notes.length === 0) errors.push('SMF contains no notes');

    const expected = snapshot.notes
      .map((n) => ({
        tick: beatToTick(n.startBeat),
        pitch: n.pitch,
        velocity: n.velocity,
      }))
      .sort((a, b) => a.tick - b.tick || a.pitch - b.pitch || a.velocity - b.velocity);

    const parsed = song.notes
      .map((n) => ({ tick: n.tick, pitch: n.pitch, velocity: n.velocity }))
      .sort((a, b) => a.tick - b.tick || a.pitch - b.pitch || a.velocity - b.velocity);

    if (expected.length !== parsed.length) {
      errors.push(`parsed note count ${parsed.length} != snapshot ${expected.length}`);
    } else {
      for (let i = 0; i < expected.length; i++) {
        const e = expected[i]!;
        const p = parsed[i]!;
        if (Math.abs(e.tick - p.tick) > 1) {
          errors.push(`tick mismatch pitch ${e.pitch}: ${p.tick} vs ${e.tick}`);
        }
        if (e.pitch !== p.pitch) errors.push(`pitch mismatch at index ${i}`);
        if (e.velocity !== p.velocity) {
          errors.push(`SMF velocity ${p.velocity} != snapshot ${e.velocity} pitch ${e.pitch}`);
        }
      }
    }
  } catch (e) {
    errors.push(`SMF parse failed: ${String(e)}`);
  }
  return { ok: errors.length === 0, errors };
}

function beatToTick(beat: number): number {
  return Math.max(0, Math.round(beat * DEFAULT_PPQ));
}

export function assertExportValid(snapshot: FinalMidiSnapshot, plan: SessionPerformancePlan): void {
  const a = validateFinalMidiSnapshot(snapshot, plan);
  const b = validateSmfBytes(snapshot);
  const errors = [...a.errors, ...b.errors];
  if (errors.length > 0) {
    throw new Error(`MIDI export validation failed:\n${errors.join('\n')}`);
  }
}
