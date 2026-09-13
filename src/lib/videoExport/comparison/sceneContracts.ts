import type { HarmonyChangeV1 } from '@/lib/comparison';

import type { CompareStoryRole, CompareTimePlanV1 } from './contracts';

export type VideoTemplateId = 'standard' | 'compare';
export type VideoMotionPreference = 'standard' | 'reduced';

export type CompareSceneCard = Readonly<{
  eventId: string;
  displayName: string;
  degreeLabel: string;
  changed: boolean;
}>;

export type CompareScenePage = Readonly<{
  id: string;
  role: CompareStoryRole;
  pageIndex: number;
  cards: readonly CompareSceneCard[];
}>;

export type CompareSceneCue = Readonly<{
  id: string;
  role: CompareStoryRole;
  eventId: string;
  sourceIndex: number;
  startSample: number;
  durationSamples: number;
  anticipationStartSample: number;
  pageIndex: number;
  currentChord: string;
  nextChord: string | null;
  changeLabel: string | null;
  changed: boolean;
}>;

export type CompareSceneCopy = Readonly<{
  hook: string;
  baseLabel: '原型';
  variantLabel: '変奏';
  closing: string;
}>;

export type CompareSceneManifestV1 = Readonly<{
  schemaVersion: 1;
  templateId: 'compare';
  themeVersion: 1;
  motion: VideoMotionPreference;
  title: string;
  productName: 'Chord Palette';
  timePlan: CompareTimePlanV1;
  copy: CompareSceneCopy;
  changes: readonly HarmonyChangeV1[];
  pages: readonly CompareScenePage[];
  cues: readonly CompareSceneCue[];
}>;

export type CompareSceneState = Readonly<{
  sample: number;
  role: CompareStoryRole;
  cue: CompareSceneCue;
  page: CompareScenePage;
  anticipating: boolean;
  anticipatedCue: CompareSceneCue | null;
  revealProgress: number;
  storyProgress: number;
}>;

export type CompareSceneValidationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | 'INVALID_VERSION'
        | 'INVALID_TIME_PLAN'
        | 'INVALID_PAGE'
        | 'INVALID_CUE'
        | 'UNSAFE_SAMPLE'
        | 'DUPLICATE_ID';
      readonly detail?: string;
    };
