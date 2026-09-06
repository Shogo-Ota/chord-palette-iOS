import {
  chordEventToEvolutionChord,
  sessionToEvolutionContext,
} from '@/features/editor/chordEvolution/chordEventAdapter';
import {
  diatonicEvent,
  diatonicSeventhEvent,
} from '@/features/editor/chordEvolution/testing/fixtures';
import { generateEvolutionCandidates, type EvolutionCandidate } from '@/lib/harmony/evolution';

import {
  materializeReharmCandidateProgression,
  selectedIndexAfterReharmCandidate,
} from '../reharmCandidateAdapter';

function sessionWith(progression: ReturnType<typeof diatonicEvent>[]) {
  return {
    key: 'C' as const,
    mode: 'major' as const,
    progression,
  };
}

function candidateFor(
  session: ReturnType<typeof sessionWith>,
  technique: EvolutionCandidate['technique'],
) {
  const candidate = generateEvolutionCandidates(
    sessionToEvolutionContext(session, { kind: 'progression' }, 'reharm'),
  ).find((item) => item.technique === technique);
  if (!candidate) {
    throw new Error(`Expected a ${technique} candidate`);
  }
  return candidate;
}

describe('L3 reharm candidate adapter', () => {
  it('materializes an insertion with stable id, total beats and candidate order', () => {
    const session = sessionWith([
      diatonicEvent('C', 'major', 0, { id: 'c' }),
      diatonicEvent('C', 'major', 5, { id: 'am' }),
    ]);
    const candidate = candidateFor(session, 'secondary_dominant');
    const result = materializeReharmCandidateProgression(session, candidate);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map(chordEventToEvolutionChord)).toEqual(candidate.after);
    expect(result.value.map((event) => event.durationBeats)).toEqual([2, 2, 4]);
    expect(result.value[1]?.id).toBe(`${candidate.id}:event:am:1`);
    expect(result.value[1]).toMatchObject({
      displayName: 'E7',
      category: 'secondaryDominant',
      isPro: true,
    });
  });

  it('maps a selection at or after the insertion to the same event identity', () => {
    const session = sessionWith([
      diatonicEvent('C', 'major', 0, { id: 'c' }),
      diatonicEvent('C', 'major', 5, { id: 'am' }),
    ]);
    const candidate = candidateFor(session, 'secondary_dominant');
    expect(selectedIndexAfterReharmCandidate(0, candidate)).toBe(0);
    expect(selectedIndexAfterReharmCandidate(1, candidate)).toBe(2);
  });

  it('materializes a tritone replacement without changing event order', () => {
    const session = sessionWith([
      diatonicSeventhEvent('C', 'major', 4, { id: 'g7' }),
      diatonicSeventhEvent('C', 'major', 0, { id: 'cmaj7' }),
    ]);
    const candidate = candidateFor(session, 'tritone_substitute');
    const result = materializeReharmCandidateProgression(session, candidate);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((event) => event.id)).toEqual(['g7', 'cmaj7']);
    expect(result.value[0]).toMatchObject({
      displayName: 'D♭7',
      category: 'substituteChord',
      rootOffset: 1,
      suffix: '7',
    });
  });

  it('fails closed on a stale baseline and malformed duration split', () => {
    const session = sessionWith([
      diatonicEvent('C', 'major', 0, { id: 'c' }),
      diatonicEvent('C', 'major', 5, { id: 'am' }),
    ]);
    const candidate = candidateFor(session, 'secondary_dominant');
    expect(
      materializeReharmCandidateProgression(
        {
          ...session,
          progression: [{ ...session.progression[0]!, durationBeats: 2 }, session.progression[1]!],
        },
        candidate,
      ),
    ).toMatchObject({ ok: false, reason: 'STALE_BASELINE' });

    const change = candidate.changes[0]!;
    if (change.kind !== 'insert_before') {
      throw new Error('Expected insertion');
    }
    const malformed: EvolutionCandidate = {
      ...candidate,
      changes: [
        {
          ...change,
          inserted: { ...change.inserted, durationBeats: 1 },
        },
      ],
    };
    expect(materializeReharmCandidateProgression(session, malformed)).toMatchObject({
      ok: false,
      reason: 'INVALID_CHANGE_SET',
    });
  });
});
