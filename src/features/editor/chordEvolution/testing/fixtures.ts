import { diatonicSevenths, diatonicTriads } from '@/data/music';
import type { EditorSession } from '@/features/editor/session';
import { generateEvolutionCandidates } from '@/lib/harmony/evolution';
import type { ChordDuration, ChordEvent, KeyMode, MajorKey } from '@/types';

import { sessionToEvolutionContext } from '../chordEventAdapter';

export function diatonicEvent(
  tonic: MajorKey,
  mode: KeyMode,
  degreeIndex: number,
  options: {
    id?: string;
    durationBeats?: ChordDuration;
  } = {},
): ChordEvent {
  const chord = diatonicTriads(tonic, mode)[degreeIndex];
  if (!chord) throw new Error(`Missing ${tonic} ${mode} degree ${degreeIndex}`);
  return {
    id: options.id ?? `event-${degreeIndex}`,
    chordId: chord.id,
    displayName: chord.displayName,
    degreeLabel: chord.degreeLabel,
    function: chord.function,
    durationBeats: options.durationBeats ?? 4,
    isPro: false,
    rootOffset: chord.rootOffset,
    suffix: chord.suffix,
    definitionId: chord.definitionId,
    keyContext: tonic,
    modeContext: mode,
    voicingPosition: 'root',
    category: 'diatonic',
  };
}

export function phase1Candidate(
  session: Pick<EditorSession, 'key' | 'mode' | 'progression'>,
  scope: { readonly kind: 'chord'; readonly index: number } | { readonly kind: 'progression' } = {
    kind: 'progression',
  },
) {
  const context = sessionToEvolutionContext(session, scope, 'seventh');
  const candidate = generateEvolutionCandidates(context)[0];
  if (!candidate) throw new Error('Expected an eligible Phase 1 candidate');
  return candidate;
}

export function diatonicSeventhEvent(
  tonic: MajorKey,
  mode: KeyMode,
  degreeIndex: number,
  options: {
    id?: string;
    durationBeats?: ChordDuration;
  } = {},
): ChordEvent {
  const source = diatonicEvent(tonic, mode, degreeIndex, options);
  const seventh = diatonicSevenths(tonic, mode)[degreeIndex];
  if (!seventh) {
    throw new Error(`Missing ${tonic} ${mode} seventh degree ${degreeIndex}`);
  }
  return {
    ...source,
    chordId: seventh.id,
    displayName: seventh.displayName,
    suffix: seventh.suffix,
    definitionId: seventh.definitionId,
  };
}

export function l2Candidates(
  session: Pick<EditorSession, 'key' | 'mode' | 'progression'>,
  scope: { readonly kind: 'chord'; readonly index: number } | { readonly kind: 'progression' } = {
    kind: 'progression',
  },
) {
  const context = sessionToEvolutionContext(session, scope, 'tension');
  return generateEvolutionCandidates(context);
}

export function withoutEventId(event: ChordEvent): Omit<ChordEvent, 'id'> {
  const { id: _id, ...withoutId } = event;
  return withoutId;
}
