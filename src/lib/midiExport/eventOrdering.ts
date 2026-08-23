export type CanonicalMidiEventKind = 'program' | 'off' | 'cc' | 'on' | 'other';

/**
 * Deterministic order for messages sharing one musical instant.
 *
 * A re-pedal boundary must release keyed notes and the old pedal tail before the
 * next pedal-down and NoteOn. Leaving CC64 Up/Down tied to sort stability can
 * finish the boundary in the Up state on one runtime.
 */
export function canonicalMidiEventPriority(
  kind: CanonicalMidiEventKind,
  controller = 0,
  value = 0,
): number {
  if (kind === 'program') return -1;
  if (kind === 'off') return 0;
  if (kind === 'cc' && controller === 64 && value < 64) return 1;
  if (kind === 'cc') return 2;
  if (kind === 'on') return 3;
  return 4;
}

export function canonicalMidiBytesPriority(bytes: readonly number[]): number {
  const status = (bytes[0] ?? 0) & 0xf0;
  if (status === 0xc0) return canonicalMidiEventPriority('program');
  if (status === 0x80) return canonicalMidiEventPriority('off');
  if (status === 0xb0) return canonicalMidiEventPriority('cc', bytes[1], bytes[2]);
  if (status === 0x90) return canonicalMidiEventPriority('on');
  return canonicalMidiEventPriority('other');
}
