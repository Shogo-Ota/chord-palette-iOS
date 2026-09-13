import {
  getDefinitionById,
  getDefinitionBySymbol,
  intervalsForChord,
  pitchClassesFromIntervals,
} from '@/lib/theory/definitions';

import type {
  CreationSnapshotV1,
  HarmonyChangedField,
  HarmonyChangeV1,
  ImmutableChordEvent,
} from './contracts';

function definitionFor(event: ImmutableChordEvent) {
  return (
    (event.definitionId ? getDefinitionById(event.definitionId) : undefined) ??
    getDefinitionBySymbol(event.suffix)
  );
}

function pitchClassSignature(event: ImmutableChordEvent): string {
  return pitchClassesFromIntervals(intervalsForChord(event.suffix, event.definitionId)).join(',');
}

function normalizedBass(event: ImmutableChordEvent): number {
  return event.bassOffset ?? event.rootOffset;
}

function notationDiffers(left: ImmutableChordEvent, right: ImmutableChordEvent): boolean {
  return (
    left.displayName !== right.displayName ||
    left.degreeLabel !== right.degreeLabel ||
    left.chordId !== right.chordId ||
    left.rootSpelling?.degreeIndex !== right.rootSpelling?.degreeIndex ||
    left.rootSpelling?.alteration !== right.rootSpelling?.alteration ||
    left.suffix !== right.suffix ||
    left.definitionId !== right.definitionId
  );
}

function changedFields(
  left: ImmutableChordEvent,
  right: ImmutableChordEvent,
): readonly HarmonyChangedField[] {
  const fields: HarmonyChangedField[] = [];
  if (left.rootOffset !== right.rootOffset) fields.push('root');

  const leftDefinition = definitionFor(left);
  const rightDefinition = definitionFor(right);
  if (
    leftDefinition == null &&
    rightDefinition == null &&
    (left.definitionId !== right.definitionId || left.suffix !== right.suffix)
  ) {
    fields.push('quality');
  } else if (leftDefinition?.quality !== rightDefinition?.quality) {
    fields.push('quality');
  } else if (
    pitchClassSignature(left) !== pitchClassSignature(right) ||
    leftDefinition?.extensions.join(',') !== rightDefinition?.extensions.join(',') ||
    leftDefinition?.alterations.join(',') !== rightDefinition?.alterations.join(',')
  ) {
    fields.push('extension');
  }

  if (normalizedBass(left) !== normalizedBass(right)) fields.push('bass');
  if (left.durationBeats !== right.durationBeats) fields.push('duration');
  return Object.freeze(fields);
}

function summaryKeyFor(fields: readonly HarmonyChangedField[]): HarmonyChangeV1['summaryKey'] {
  if (fields.length === 1 && fields[0] === 'bass') return 'replace-bass';
  if (fields.length === 1 && fields[0] === 'duration') return 'replace-duration';
  return 'replace-chord';
}

export function semanticHarmonyDiff(
  base: CreationSnapshotV1,
  variant: CreationSnapshotV1,
): readonly HarmonyChangeV1[] {
  const changes: HarmonyChangeV1[] = [];
  const variantById = new Map(
    variant.progression.map((event, index) => [event.id, { event, index }] as const),
  );
  const baseIds = new Set(base.progression.map((event) => event.id));

  base.progression.forEach((baseEvent, baseIndex) => {
    const match = variantById.get(baseEvent.id);
    if (!match) {
      changes.push(
        Object.freeze({
          changeId: `remove:${baseEvent.id}:${baseIndex}`,
          kind: 'remove',
          baseIndex,
          variantIndex: null,
          baseEventId: baseEvent.id,
          variantEventId: null,
          changedFields: Object.freeze([]),
          summaryKey: 'remove-chord',
        }),
      );
      return;
    }

    const fields = changedFields(baseEvent, match.event);
    if (fields.length > 0) {
      changes.push(
        Object.freeze({
          changeId: `replace:${baseEvent.id}:${baseIndex}:${match.index}`,
          kind: 'replace',
          baseIndex,
          variantIndex: match.index,
          baseEventId: baseEvent.id,
          variantEventId: match.event.id,
          changedFields: fields,
          summaryKey: summaryKeyFor(fields),
        }),
      );
    } else if (notationDiffers(baseEvent, match.event)) {
      changes.push(
        Object.freeze({
          changeId: `notation:${baseEvent.id}:${baseIndex}:${match.index}`,
          kind: 'notation-only',
          baseIndex,
          variantIndex: match.index,
          baseEventId: baseEvent.id,
          variantEventId: match.event.id,
          changedFields: Object.freeze([]),
          summaryKey: 'notation-only',
        }),
      );
    }
  });

  variant.progression.forEach((variantEvent, variantIndex) => {
    if (baseIds.has(variantEvent.id)) return;
    changes.push(
      Object.freeze({
        changeId: `insert:${variantEvent.id}:${variantIndex}`,
        kind: 'insert',
        baseIndex: null,
        variantIndex,
        baseEventId: null,
        variantEventId: variantEvent.id,
        changedFields: Object.freeze([]),
        summaryKey: 'insert-chord',
      }),
    );
  });

  return Object.freeze(changes);
}
