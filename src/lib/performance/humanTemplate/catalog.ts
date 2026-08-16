/**
 * The Human MIDI Template catalog — the teacher performances the engine transplants.
 *
 * Every entry is a real human take exported from `LocalAnalysis/accompaniment_patterns`
 * and marked STRICT_V2_CAPABLE in the approved pattern pool. Nothing here is
 * synthesized to fill a slot: a style offers as many Types as there are real takes.
 *
 * Templates are loaded lazily. A take is ~150 KB of JSON and normalizing it walks
 * every attack, so paying that at import time for fifteen of them would show up in
 * app start. The first realize of a Type pays it once; the result is memoized.
 */

import type { AccompanimentPattern } from '@/types';

import { normalizeHumanTemplate, type HumanMidiTemplate, type RawHumanTemplateJson } from './types';

export const HUMAN_TEMPLATE_NORMAL_P1_A1 = 'human.normal.p1_a1';
export const HUMAN_TEMPLATE_NORMAL_P1_C1 = 'human.normal.p1_c1';
export const HUMAN_TEMPLATE_NORMAL_P1_A3 = 'human.normal.p1_a3';
export const HUMAN_TEMPLATE_NORMAL_P1_C3 = 'human.normal.p1_c3';
export const HUMAN_TEMPLATE_NORMAL_P1_A5 = 'human.normal.p1_a5';

export const HUMAN_TEMPLATE_BALLAD_P1_C7 = 'human.ballad.p1_c7';
export const HUMAN_TEMPLATE_BALLAD_P1_A7 = 'human.ballad.p1_a7';
export const HUMAN_TEMPLATE_BALLAD_P1_C8 = 'human.ballad.p1_c8';
export const HUMAN_TEMPLATE_BALLAD_P1_A8 = 'human.ballad.p1_a8';
export const HUMAN_TEMPLATE_BALLAD_P4_A7 = 'human.ballad.p4_a7';

export const HUMAN_TEMPLATE_ARPEGGIO_P1_C10 = 'human.arpeggio.p1_c10';
export const HUMAN_TEMPLATE_ARPEGGIO_P1_A10 = 'human.arpeggio.p1_a10';
export const HUMAN_TEMPLATE_ARPEGGIO_P1_C11 = 'human.arpeggio.p1_c11';
export const HUMAN_TEMPLATE_ARPEGGIO_P1_A11 = 'human.arpeggio.p1_a11';
export const HUMAN_TEMPLATE_ARPEGGIO_P2_A10 = 'human.arpeggio.p2_a10';

export const HUMAN_TEMPLATE_VARIATION_P1_C12 = 'human.variation.p1_c12';
export const HUMAN_TEMPLATE_VARIATION_P1_C13 = 'human.variation.p1_c13';
export const HUMAN_TEMPLATE_VARIATION_P1_C14 = 'human.variation.p1_c14';

type TemplateEntry = {
  /** Pool source id (`P1_A1`), kept so a log or an audit can find the take again. */
  sourceId: string;
  category: HumanMidiTemplate['category'];
  /** Deferred `require` — Metro only runs the JSON module when a Type is first used. */
  load: () => unknown;
};

const REGISTRY: Readonly<Record<string, TemplateEntry>> = {
  [HUMAN_TEMPLATE_NORMAL_P1_A1]: {
    sourceId: 'P1_A1',
    category: 'normal',
    load: () => require('./data/P1_A1.json'),
  },
  [HUMAN_TEMPLATE_NORMAL_P1_C1]: {
    sourceId: 'P1_C1',
    category: 'normal',
    load: () => require('./data/P1_C1.json'),
  },
  [HUMAN_TEMPLATE_NORMAL_P1_A3]: {
    sourceId: 'P1_A3',
    category: 'normal',
    load: () => require('./data/P1_A3.json'),
  },
  [HUMAN_TEMPLATE_NORMAL_P1_C3]: {
    sourceId: 'P1_C3',
    category: 'normal',
    load: () => require('./data/P1_C3.json'),
  },
  [HUMAN_TEMPLATE_NORMAL_P1_A5]: {
    sourceId: 'P1_A5',
    category: 'normal',
    load: () => require('./data/P1_A5.json'),
  },
  [HUMAN_TEMPLATE_BALLAD_P1_C7]: {
    sourceId: 'P1_C7',
    category: 'ballad',
    load: () => require('./data/P1_C7.json'),
  },
  [HUMAN_TEMPLATE_BALLAD_P1_A7]: {
    sourceId: 'P1_A7',
    category: 'ballad',
    load: () => require('./data/P1_A7.json'),
  },
  [HUMAN_TEMPLATE_BALLAD_P1_C8]: {
    sourceId: 'P1_C8',
    category: 'ballad',
    load: () => require('./data/P1_C8.json'),
  },
  [HUMAN_TEMPLATE_BALLAD_P1_A8]: {
    sourceId: 'P1_A8',
    category: 'ballad',
    load: () => require('./data/P1_A8.json'),
  },
  [HUMAN_TEMPLATE_BALLAD_P4_A7]: {
    sourceId: 'P4_A7',
    category: 'ballad',
    load: () => require('./data/P4_A7.json'),
  },
  [HUMAN_TEMPLATE_ARPEGGIO_P1_C10]: {
    sourceId: 'P1_C10',
    category: 'arpeggio',
    load: () => require('./data/P1_C10.json'),
  },
  [HUMAN_TEMPLATE_ARPEGGIO_P1_A10]: {
    sourceId: 'P1_A10',
    category: 'arpeggio',
    load: () => require('./data/P1_A10.json'),
  },
  [HUMAN_TEMPLATE_ARPEGGIO_P1_C11]: {
    sourceId: 'P1_C11',
    category: 'arpeggio',
    load: () => require('./data/P1_C11.json'),
  },
  [HUMAN_TEMPLATE_ARPEGGIO_P1_A11]: {
    sourceId: 'P1_A11',
    category: 'arpeggio',
    load: () => require('./data/P1_A11.json'),
  },
  [HUMAN_TEMPLATE_ARPEGGIO_P2_A10]: {
    sourceId: 'P2_A10',
    category: 'arpeggio',
    load: () => require('./data/P2_A10.json'),
  },
  [HUMAN_TEMPLATE_VARIATION_P1_C12]: {
    sourceId: 'P1_C12',
    category: 'variation',
    load: () => require('./data/P1_C12.json'),
  },
  [HUMAN_TEMPLATE_VARIATION_P1_C13]: {
    sourceId: 'P1_C13',
    category: 'variation',
    load: () => require('./data/P1_C13.json'),
  },
  [HUMAN_TEMPLATE_VARIATION_P1_C14]: {
    sourceId: 'P1_C14',
    category: 'variation',
    load: () => require('./data/P1_C14.json'),
  },
};

const NORMALIZED = new Map<string, HumanMidiTemplate>();

/** Every template id the catalog can realize, in registration order. */
export const PRODUCTION_HUMAN_TEMPLATE_IDS = Object.keys(REGISTRY) as readonly string[];

export type ProductionHumanTemplateId = string;

export function humanTemplateById(id: string): HumanMidiTemplate | undefined {
  const cached = NORMALIZED.get(id);
  if (cached) return cached;
  const entry = REGISTRY[id];
  if (!entry) return undefined;
  const template = normalizeHumanTemplate(entry.load() as RawHumanTemplateJson, entry.category);
  NORMALIZED.set(id, template);
  return template;
}

/** Pool source id for a template — for logs, audits and the pattern-pool cross-check. */
export function humanTemplateSourceId(id: string): string | undefined {
  return REGISTRY[id]?.sourceId;
}

/**
 * The template a rhythm falls back to when the chosen Type does not name one
 * (a project saved before Types existed, or a rhythm with no teacher take).
 */
export function humanTemplateIdForPattern(
  pattern: AccompanimentPattern,
): ProductionHumanTemplateId | undefined {
  switch (pattern) {
    case 'natural':
      return HUMAN_TEMPLATE_NORMAL_P1_A1;
    case 'relaxed':
      return HUMAN_TEMPLATE_BALLAD_P1_C7;
    case 'arpeggio':
      return HUMAN_TEMPLATE_VARIATION_P1_C12;
    default:
      return undefined;
  }
}

export function humanTemplateCategoryLabel(id: ProductionHumanTemplateId): string {
  const category = REGISTRY[id]?.category;
  switch (category) {
    case 'normal':
      return 'Normal';
    case 'ballad':
      return 'Ballad';
    case 'arpeggio':
      return 'Arpeggio';
    case 'variation':
      return 'Variation';
    default:
      return id;
  }
}
