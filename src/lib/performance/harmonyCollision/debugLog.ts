/**
 * Reject records, in the fixed contract format.
 *
 * Formatting only — the domain never writes to a console, so the caller decides
 * where a record goes.
 */

import { pitchClassName } from './noteNames';
import type { HarmonyCollisionReport, HarmonyCollisionViolation } from './types';

export function formatHarmonyCollision(violation: HarmonyCollisionViolation): string {
  const allowed = violation.allowedPitchClasses.map(pitchClassName).join(' ');
  const lines = [
    '[HarmonyCollision]',
    `Chord: ${violation.chordSymbol}`,
    `Root: ${pitchClassName(violation.chordRoot)}`,
    `Allowed: ${allowed}`,
    violation.noteB == null
      ? `Note: ${violation.noteA}`
      : `Notes: ${violation.noteA} / ${violation.noteB}`,
    violation.midiB == null
      ? `MIDI: ${violation.midiA}`
      : `MIDI: ${violation.midiA} / ${violation.midiB}`,
  ];
  if (violation.intervalSemitones != null) lines.push(`Interval: ${violation.intervalSemitones}`);
  if (violation.lowerNote != null) lines.push(`Lower: ${violation.lowerNote}`);
  lines.push(
    `Rule: ${violation.ruleId}`,
    `Reason: ${violation.reason}`,
    `Style: ${violation.styleId ?? '(unspecified)'}`,
    `Bar: ${violation.barIndex}`,
    `Beat: ${violation.beatPosition}`,
    `Result: ${violation.result}`,
  );
  return lines.join('\n');
}

/** Every reject in a report, newest format, separated by a blank line. */
export function formatHarmonyCollisionReport(report: HarmonyCollisionReport): string {
  return report.rejects.map(formatHarmonyCollision).join('\n\n');
}
