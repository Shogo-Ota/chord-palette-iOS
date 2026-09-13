import type {
  FinalMidiControlChange,
  FinalMidiMarker,
  FinalMidiNote,
  FinalMidiSnapshot,
} from '@/lib/performance/finalMidi/types';

export type ComposeCompareFinalMidiResult =
  | { readonly ok: true; readonly value: FinalMidiSnapshot }
  | {
      readonly ok: false;
      readonly reason:
        | 'TEMPO_MISMATCH'
        | 'METER_MISMATCH'
        | 'INSTRUMENT_MISMATCH'
        | 'DURATION_MISMATCH'
        | 'INVALID_EVENT';
    };

function validBeat(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function validSnapshot(snapshot: FinalMidiSnapshot): boolean {
  return (
    validBeat(snapshot.totalBeats) &&
    snapshot.totalBeats > 0 &&
    snapshot.notes.every(
      (note) =>
        validBeat(note.startBeat) &&
        Number.isFinite(note.durationBeat) &&
        note.durationBeat > 0 &&
        note.startBeat < snapshot.totalBeats &&
        Number.isInteger(note.pitch) &&
        note.pitch >= 0 &&
        note.pitch <= 127 &&
        Number.isInteger(note.velocity) &&
        note.velocity >= 1 &&
        note.velocity <= 127,
    ) &&
    snapshot.controlChanges.every(
      (event) =>
        validBeat(event.startBeat) &&
        event.startBeat <= snapshot.totalBeats &&
        Number.isInteger(event.controller) &&
        Number.isInteger(event.value),
    )
  );
}

function shiftedNote(note: FinalMidiNote, offset: number): FinalMidiNote {
  return { ...note, startBeat: note.startBeat + offset };
}

function shiftedControl(event: FinalMidiControlChange, offset: number): FinalMidiControlChange {
  return { ...event, startBeat: event.startBeat + offset };
}

function shiftedMarker(marker: FinalMidiMarker, offset: number): FinalMidiMarker {
  return { ...marker, startBeat: marker.startBeat + offset };
}

export function composeCompareFinalMidi(
  base: FinalMidiSnapshot,
  variant: FinalMidiSnapshot,
): ComposeCompareFinalMidiResult {
  if (base.bpm !== variant.bpm) return { ok: false, reason: 'TEMPO_MISMATCH' };
  if (
    base.beatsPerBar !== variant.beatsPerBar ||
    base.timeSignature.numerator !== variant.timeSignature.numerator ||
    base.timeSignature.denominator !== variant.timeSignature.denominator
  ) {
    return { ok: false, reason: 'METER_MISMATCH' };
  }
  if (
    base.instrumentId !== variant.instrumentId ||
    base.gmProgram !== variant.gmProgram ||
    base.drumMode !== variant.drumMode
  ) {
    return { ok: false, reason: 'INSTRUMENT_MISMATCH' };
  }
  if (base.totalBeats !== variant.totalBeats) {
    return { ok: false, reason: 'DURATION_MISMATCH' };
  }
  if (!validSnapshot(base) || !validSnapshot(variant)) {
    return { ok: false, reason: 'INVALID_EVENT' };
  }

  const offset = base.totalBeats;
  return {
    ok: true,
    value: {
      ...base,
      totalBeats: base.totalBeats + variant.totalBeats,
      notes: [
        ...base.notes.map((note) => ({ ...note })),
        ...variant.notes.map((note) => shiftedNote(note, offset)),
      ],
      controlChanges: [
        ...base.controlChanges.map((event) => ({ ...event })),
        ...variant.controlChanges.map((event) => shiftedControl(event, offset)),
      ],
      markers: [
        ...base.markers.map((marker) => ({
          ...marker,
          label: `A · ${marker.label}`,
        })),
        ...variant.markers.map((marker) => ({
          ...shiftedMarker(marker, offset),
          label: `B · ${marker.label}`,
        })),
      ],
    },
  };
}
