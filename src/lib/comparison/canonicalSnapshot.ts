import type { CreationSnapshotV1, ImmutableChordEvent } from './contracts';

type SnapshotIdentity = Pick<
  CreationSnapshotV1,
  | 'key'
  | 'mode'
  | 'bpm'
  | 'beatsPerBar'
  | 'progression'
  | 'grooveId'
  | 'accompanimentPattern'
  | 'accompanimentVariant'
  | 'accompanimentEnergy'
  | 'instrumentId'
  | 'instrumentEffect'
  | 'releaseCut'
  | 'octaveShift'
  | 'drumMode'
  | 'drumBeat'
>;

function canonicalEvent(event: ImmutableChordEvent): readonly unknown[] {
  return [
    event.id,
    event.chordId,
    event.displayName,
    event.degreeLabel,
    event.function,
    event.durationBeats,
    event.isPro,
    event.rootOffset,
    event.suffix,
    event.definitionId ?? null,
    event.rootSpelling?.degreeIndex ?? null,
    event.rootSpelling?.alteration ?? null,
    event.bassOffset ?? null,
    event.bassNote ?? null,
    event.variation ?? null,
    event.category ?? null,
    event.keyContext ?? null,
    event.modeContext ?? null,
    event.voicingPosition ?? null,
  ];
}

/** Stable serialization with an explicit field order; object-key order is irrelevant. */
export function canonicalSnapshotContent(snapshot: SnapshotIdentity): string {
  return JSON.stringify([
    1,
    snapshot.key,
    snapshot.mode,
    snapshot.bpm,
    snapshot.beatsPerBar,
    snapshot.grooveId,
    snapshot.accompanimentPattern,
    snapshot.accompanimentVariant,
    snapshot.accompanimentEnergy,
    snapshot.instrumentId,
    snapshot.instrumentEffect,
    snapshot.releaseCut,
    snapshot.octaveShift,
    snapshot.drumMode,
    snapshot.drumBeat,
    snapshot.progression.map(canonicalEvent),
  ]);
}

function fnv1a(text: string, seed: number): string {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Local content identity used for stale-draft checks. It is deliberately not a
 * cryptographic/public identifier and must never be used as a share token.
 */
export function fingerprintSnapshot(snapshot: SnapshotIdentity): string {
  const canonical = canonicalSnapshotContent(snapshot);
  return `${fnv1a(canonical, 0x811c9dc5)}${fnv1a(canonical, 0x9e3779b9)}`;
}
