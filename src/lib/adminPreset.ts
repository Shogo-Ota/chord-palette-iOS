/**
 * Admin/operator authoring domain (pure — no React Native / Expo).
 *
 * Converts a concrete progression (the editor's `ChordEvent[]`, spelled for its
 * current key) into a *degree-based* `Preset` that auto-transposes, and emits a
 * copy-paste-ready TS source block so the operator can ship curated presets by
 * committing them into `src/data/presets.ts`.
 */

import type { ChordEvent, Preset, PresetCategory, PresetChord } from '@/types';

/** Curated accent swatches offered when authoring a preset. */
export const PRESET_ACCENTS = [
  '#eab308',
  '#d6409f',
  '#3b82f6',
  '#ef4444',
  '#8b5cf6',
  '#22c55e',
] as const;

const mod12 = (n: number): number => ((n % 12) + 12) % 12;

/** "C · G · Am · F" display string built from the placed chords. */
export function chordsDisplayFor(events: ChordEvent[]): string {
  return events.map((e) => e.displayName).join(' · ');
}

/** Degree-based chord list (offset from tonic + quality), transposable by key. */
export function eventsToPresetChords(events: ChordEvent[]): PresetChord[] {
  return events.map((e) => {
    const chord: PresetChord = {
      offset: mod12(e.rootOffset),
      suffix: e.suffix,
      function: e.function,
      degreeLabel: e.degreeLabel,
      durationBeats: e.durationBeats,
    };
    if (e.bassOffset != null) chord.bassOffset = mod12(e.bassOffset);
    if (e.bassNote) chord.bassNote = e.bassNote;
    if (e.variation) chord.variation = e.variation;
    return chord;
  });
}

export function genPresetId(): string {
  return `up-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export type PresetDraft = {
  /** Reuse an id to overwrite an existing preset; omitted → new id. */
  id?: string;
  name: string;
  category: PresetCategory;
  tags: string[];
  accent: string;
  events: ChordEvent[];
};

/** Build a fully-formed, degree-based `Preset` from an authoring draft. */
export function buildPresetFromDraft(draft: PresetDraft): Preset {
  return {
    id: draft.id ?? genPresetId(),
    name: draft.name.trim() || '無題の進行',
    category: draft.category,
    chordsDisplay: chordsDisplayFor(draft.events),
    tags: draft.tags.map((t) => t.trim()).filter((t) => t.length > 0),
    accent: draft.accent,
    chords: eventsToPresetChords(draft.events),
  };
}

/** Split a free-text tag field ("明るい, 王道") into a clean tag array. */
export function parseTags(input: string): string[] {
  return input
    .split(/[,、\n]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 4);
}

function chordToTs(c: PresetChord): string {
  const parts = [
    `offset: ${c.offset}`,
    `suffix: ${JSON.stringify(c.suffix)}`,
    `function: ${JSON.stringify(c.function)}`,
    `degreeLabel: ${JSON.stringify(c.degreeLabel)}`,
    `durationBeats: ${c.durationBeats}`,
  ];
  if (c.bassOffset != null) parts.push(`bassOffset: ${c.bassOffset}`);
  if (c.bassNote) parts.push(`bassNote: ${JSON.stringify(c.bassNote)}`);
  if (c.variation) parts.push(`variation: ${JSON.stringify(c.variation)}`);
  return `    { ${parts.join(', ')} },`;
}

/** A single `Preset` as a TS object literal (trailing comma included). */
export function presetToTsSource(preset: Preset): string {
  const chords = preset.chords.map(chordToTs).join('\n');
  return [
    '  {',
    `    id: ${JSON.stringify(preset.id)},`,
    `    name: ${JSON.stringify(preset.name)},`,
    `    category: ${JSON.stringify(preset.category)},`,
    `    chordsDisplay: ${JSON.stringify(preset.chordsDisplay)},`,
    `    tags: ${JSON.stringify(preset.tags)},`,
    `    accent: ${JSON.stringify(preset.accent)},`,
    '    chords: [',
    chords,
    '    ],',
    '  },',
  ].join('\n');
}

/** All presets as one paste-ready block for `PRESETS: Preset[]` in presets.ts. */
export function presetsToTsSource(presets: Preset[]): string {
  return presets.map(presetToTsSource).join('\n');
}
