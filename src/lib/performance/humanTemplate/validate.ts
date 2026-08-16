/**
 * Automatic QA checks for strict-v2 human template output (release gate helpers).
 */

import { resolveAllowed } from '../strictV2';
import type { ChordHarmonyInput } from '../strictV2';
import type { NoteEvent } from '../NoteEvent';
import { realizeHumanTemplate } from './realize';
import type { HumanMidiTemplate } from './types';

export interface ValidationResult {
  pass: boolean;
  illegalPitches: number[];
  severeMud: boolean;
  extremeLeaps: number;
  timingPreserved: boolean;
  durationPreserved: boolean;
  velocityPreserved: boolean;
  pedalEventCount: number;
}

export interface ValidateChordSpan {
  startBeat: number;
  durationBeats: number;
  harmony: ChordHarmonyInput;
}

function hasSevereMud(events: NoteEvent[]): boolean {
  const byTime = new Map<number, number[]>();
  for (const e of events) {
    const t = Math.round(e.timeBeat * 1000);
    const list = byTime.get(t) ?? [];
    list.push(e.pitch);
    byTime.set(t, list);
  }
  for (const pitches of byTime.values()) {
    const sp = [...pitches].sort((a, b) => a - b);
    for (let i = 0; i < sp.length - 1; i++) {
      if (sp[i]! < 55 && sp[i + 1]! < 55 && sp[i + 1]! - sp[i]! <= 2) return true;
    }
  }
  return false;
}

function countExtremeLeaps(events: NoteEvent[], chords: ValidateChordSpan[]): number {
  if (chords.length < 2) return 0;
  const sorted = [...events].sort((a, b) => a.timeBeat - b.timeBeat || a.pitch - b.pitch);
  const topByChord: number[] = [];
  for (let ci = 0; ci < chords.length; ci++) {
    const c = chords[ci]!;
    const inChord = sorted.filter(
      (e) => e.timeBeat >= c.startBeat - 1e-6 && e.timeBeat < c.startBeat + c.durationBeats,
    );
    if (inChord.length === 0) continue;
    const attackTimes = [...new Set(inChord.map((e) => Math.round(e.timeBeat * 1000)))].sort(
      (a, b) => a - b,
    );
    const lastAttackTime = attackTimes[attackTimes.length - 1]!;
    const lastAttackNotes = inChord.filter(
      (e) => Math.round(e.timeBeat * 1000) === lastAttackTime,
    );
    topByChord.push(Math.max(...lastAttackNotes.map((e) => e.pitch)));
  }
  let leaps = 0;
  for (let i = 1; i < topByChord.length; i++) {
    if (Math.abs(topByChord[i]! - topByChord[i - 1]!) > 12) leaps++;
  }
  return leaps;
}

export function validateHumanTemplateOutput(
  template: HumanMidiTemplate,
  chords: ValidateChordSpan[],
  events: NoteEvent[],
): ValidationResult {
  const illegalPitches: number[] = [];
  for (const e of events) {
    const chord = chords.find(
      (c) => e.timeBeat >= c.startBeat - 1e-6 && e.timeBeat < c.startBeat + c.durationBeats,
    );
    if (!chord) continue;
    const allowed = resolveAllowed(chord.harmony);
    if (!allowed.containsPitch(e.pitch)) illegalPitches.push(e.pitch);
  }

  const realized = realizeHumanTemplate(
    template,
    chords.map((c) => ({ ...c, bassMidi: [], bodyMidi: [] })),
    { seed: 1, velocityCenter: 68 },
  );

  const timingPreserved =
    realized.length > 0 &&
    Math.abs(realized[0]!.timeBeat - events[0]!.timeBeat) < 1e-6 &&
    realized.length === events.length;

  const durationPreserved =
    realized.length === events.length &&
    realized.every((r, i) => Math.abs(r.durationBeat - events[i]!.durationBeat) < 1e-6);

  const velocityPreserved =
    realized.length === events.length &&
    realized.every((r, i) => r.velocity === events[i]!.velocity);

  return {
    pass:
      illegalPitches.length === 0 &&
      !hasSevereMud(events) &&
      countExtremeLeaps(events, chords) <= 1,
    illegalPitches,
    severeMud: hasSevereMud(events),
    extremeLeaps: countExtremeLeaps(events, chords),
    timingPreserved,
    durationPreserved,
    velocityPreserved,
    pedalEventCount: template.pedalEvents?.length ?? 0,
  };
}
