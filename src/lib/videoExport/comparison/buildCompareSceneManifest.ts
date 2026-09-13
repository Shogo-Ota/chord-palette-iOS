import type { CreationSnapshotV1, HarmonyChangeV1, ImmutableChordEvent } from '@/lib/comparison';

import { buildCompareSceneCopy } from './compareCopy';
import type { CompareStoryRole, CompareTimePlanV1 } from './contracts';
import type {
  CompareSceneCue,
  CompareSceneManifestV1,
  CompareScenePage,
  VideoMotionPreference,
} from './sceneContracts';

export type BuildCompareSceneManifestInput = Readonly<{
  base: CreationSnapshotV1;
  variant: CreationSnapshotV1;
  timePlan: CompareTimePlanV1;
  changes: readonly HarmonyChangeV1[];
  motion: VideoMotionPreference;
  title?: string;
}>;

function changedIds(
  changes: readonly HarmonyChangeV1[],
  role: CompareStoryRole,
): ReadonlySet<string> {
  return new Set(
    changes.flatMap((change) => {
      const id = role === 'base' ? change.baseEventId : change.variantEventId;
      return id && change.kind !== 'notation-only' ? [id] : [];
    }),
  );
}

function makePages(
  role: CompareStoryRole,
  progression: readonly ImmutableChordEvent[],
  changed: ReadonlySet<string>,
): readonly CompareScenePage[] {
  const pages: CompareScenePage[] = [];
  for (let start = 0; start < progression.length; start += 4) {
    const pageIndex = start / 4;
    pages.push(
      Object.freeze({
        id: `${role}:page:${pageIndex}`,
        role,
        pageIndex,
        cards: Object.freeze(
          progression.slice(start, start + 4).map((event) =>
            Object.freeze({
              eventId: event.id,
              displayName: event.displayName,
              degreeLabel: event.degreeLabel,
              changed: changed.has(event.id),
            }),
          ),
        ),
      }),
    );
  }
  return Object.freeze(pages);
}

function audibleChangeFor(
  changes: readonly HarmonyChangeV1[],
  eventId: string,
): HarmonyChangeV1 | undefined {
  return changes.find(
    (change) => change.kind !== 'notation-only' && change.variantEventId === eventId,
  );
}

function changeLabel(
  change: HarmonyChangeV1 | undefined,
  baseById: ReadonlyMap<string, ImmutableChordEvent>,
  variantById: ReadonlyMap<string, ImmutableChordEvent>,
): string | null {
  if (!change?.baseEventId || !change.variantEventId) return null;
  const base = baseById.get(change.baseEventId);
  const variant = variantById.get(change.variantEventId);
  return base && variant ? `${base.displayName} → ${variant.displayName}` : null;
}

export function buildCompareSceneManifest(
  input: BuildCompareSceneManifestInput,
): CompareSceneManifestV1 {
  const baseChanged = changedIds(input.changes, 'base');
  const variantChanged = changedIds(input.changes, 'variant');
  const baseById = new Map(input.base.progression.map((event) => [event.id, event]));
  const variantById = new Map(input.variant.progression.map((event) => [event.id, event]));
  const pages = Object.freeze([
    ...makePages('base', input.base.progression, baseChanged),
    ...makePages('variant', input.variant.progression, variantChanged),
  ]);

  const eventsByRole = {
    base: input.timePlan.harmonyEvents.filter((event) => event.role === 'base'),
    variant: input.timePlan.harmonyEvents.filter((event) => event.role === 'variant'),
  } as const;
  const cues: CompareSceneCue[] = [];

  for (const role of ['base', 'variant'] as const) {
    const events = eventsByRole[role];
    events.forEach((event, index) => {
      const source =
        role === 'base'
          ? input.base.progression[event.sourceIndex]
          : input.variant.progression[event.sourceIndex];
      if (!source) return;
      const change = role === 'variant' ? audibleChangeFor(input.changes, source.id) : undefined;
      const previousDuration = events[index - 1]?.durationSamples ?? 0;
      const anticipationSamples =
        role === 'variant' && change
          ? Math.min(
              Math.round(input.timePlan.sampleRate * 0.3),
              Math.round(previousDuration * 0.5),
            )
          : 0;
      cues.push(
        Object.freeze({
          id: `cue:${event.id}`,
          role,
          eventId: source.id,
          sourceIndex: event.sourceIndex,
          startSample: event.startSample,
          durationSamples: event.durationSamples,
          anticipationStartSample: Math.max(0, event.startSample - anticipationSamples),
          pageIndex: Math.floor(event.sourceIndex / 4),
          currentChord: source.displayName,
          nextChord: events[index + 1]?.displayName ?? null,
          changeLabel: changeLabel(change, baseById, variantById),
          changed: role === 'base' ? baseChanged.has(source.id) : variantChanged.has(source.id),
        }),
      );
    });
  }

  return Object.freeze({
    schemaVersion: 1,
    templateId: 'compare',
    themeVersion: 1,
    motion: input.motion,
    title: (input.title ?? input.variant.title).trim(),
    productName: 'Chord Palette',
    timePlan: input.timePlan,
    copy: buildCompareSceneCopy(input.changes),
    changes: Object.freeze([...input.changes]),
    pages,
    cues: Object.freeze(cues),
  });
}
