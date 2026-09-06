import {
  chordEventToEvolutionChord,
  materializeCandidateProgression,
  sessionToEvolutionContext,
} from '@/features/editor/chordEvolution/chordEventAdapter';
import {
  diatonicEvent,
  diatonicSeventhEvent,
  l2Candidates,
  phase1Candidate,
} from '@/features/editor/chordEvolution/testing/fixtures';
import type { EvolutionCandidate, EvolutionChord } from '@/lib/harmony/evolution';
import type { ChordEvent } from '@/types';

function sessionWith(progression: ChordEvent[]) {
  return { key: 'C' as const, mode: 'major' as const, progression };
}

function identityCandidate(chord: EvolutionChord): EvolutionCandidate {
  return {
    id: 'identity',
    level: 'seventh',
    technique: 'add_seventh',
    scope: { kind: 'progression' },
    before: [chord],
    after: [chord],
    changes: [],
    requiredTier: 'FREE',
    theoryLabel: 'DIATONIC_SEVENTH',
    rationaleCode: 'DIATONIC_TRIAD_TO_SEVENTH',
    score: { status: 'UNEVALUATED' },
    generationMethod: 'RULE_BASED',
    evidence: 'DESIGN_TARGET',
    theorySources: [],
  };
}

describe('ChordEvent evolution adapter', () => {
  it('projects every domain-owned ChordEvent attribute', () => {
    const event: ChordEvent = {
      ...diatonicEvent('C', 'major', 0),
      id: 'stable-event',
      chordId: 'C/E',
      rootSpelling: { degreeIndex: 0, alteration: 0 },
      bassOffset: 4,
      bassNote: 'E',
      durationBeats: 2,
      voicingPosition: 'first',
    };

    expect(chordEventToEvolutionChord(event)).toEqual({
      eventId: 'stable-event',
      chordId: 'C/E',
      symbol: {
        rootOffset: 0,
        suffix: '',
        definitionId: 'major',
        rootSpelling: { degreeIndex: 0, alteration: 0 },
        bassOffset: 4,
      },
      function: 'tonic',
      durationBeats: 2,
      voicingPosition: 'first',
    });
  });

  it('uses session tonic and mode and never infers a local context', () => {
    const event: ChordEvent = {
      ...diatonicEvent('C', 'major', 0),
      keyContext: 'A',
      modeContext: 'minor',
    };
    const context = sessionToEvolutionContext(
      sessionWith([event]),
      { kind: 'chord', index: 0 },
      'seventh',
    );

    expect(context.tonic).toBe('C');
    expect(context.mode).toBe('major');
    expect(context.progression[0]?.localHarmonicContext).toBeUndefined();
  });

  it('round-trips every non-domain envelope attribute for an unchanged chord', () => {
    const event: ChordEvent = {
      ...diatonicEvent('C', 'major', 0),
      isPro: true,
      variation: 'source-variation',
      category: 'variation',
      rootSpelling: { degreeIndex: 0, alteration: 0 },
      keyContext: 'A',
      modeContext: 'minor',
    };
    const domainChord = chordEventToEvolutionChord(event);
    const result = materializeCandidateProgression(
      sessionWith([event]),
      identityCandidate(domainChord),
    );

    expect(result).toEqual({ ok: true, value: [event] });
    if (result.ok) {
      expect(result.value[0]).not.toBe(event);
      expect(result.value[0]?.rootSpelling).not.toBe(event.rootSpelling);
    }
  });

  it('materializes a changed chord using existing spelling primitives', () => {
    const event: ChordEvent = {
      ...diatonicEvent('C', 'major', 0),
      isPro: true,
      category: 'variation',
      variation: 'source-variation',
    };
    const session = sessionWith([event]);
    const candidate = phase1Candidate(session);
    const result = materializeCandidateProgression(session, candidate);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toMatchObject({
      id: event.id,
      chordId: 'Cmaj7',
      displayName: 'Cmaj7',
      degreeLabel: event.degreeLabel,
      suffix: 'maj7',
      definitionId: 'maj7',
      isPro: true,
      category: 'variation',
      variation: 'source-variation',
      keyContext: 'C',
      modeContext: 'major',
    });
  });

  it('rejects a stale source progression', () => {
    const event = diatonicEvent('C', 'major', 0);
    const candidate = phase1Candidate(sessionWith([event]));
    const changedCurrent: ChordEvent = {
      ...event,
      chordId: 'Cm',
      displayName: 'Cm',
      suffix: 'm',
      definitionId: 'minor',
    };

    expect(materializeCandidateProgression(sessionWith([changedCurrent]), candidate)).toMatchObject(
      { ok: false, reason: 'STALE_BASELINE' },
    );
  });

  it('rejects length, unknown-id and order changes', () => {
    const progression = [
      diatonicEvent('C', 'major', 0, { id: 'a' }),
      diatonicEvent('C', 'major', 4, { id: 'b' }),
    ];
    const session = sessionWith(progression);
    const candidate = phase1Candidate(session);

    expect(
      materializeCandidateProgression(session, {
        ...candidate,
        after: candidate.after.slice(0, 1),
      }),
    ).toMatchObject({ ok: false, reason: 'LENGTH_CHANGED' });
    expect(
      materializeCandidateProgression(session, {
        ...candidate,
        after: [{ ...candidate.after[0]!, eventId: 'unknown' }, candidate.after[1]!],
      }),
    ).toMatchObject({ ok: false, reason: 'UNKNOWN_EVENT_ID' });
    expect(
      materializeCandidateProgression(session, {
        ...candidate,
        after: [candidate.after[1]!, candidate.after[0]!],
      }),
    ).toMatchObject({ ok: false, reason: 'EVENT_ORDER_CHANGED' });
  });

  it('rejects total-beat and per-event duration changes', () => {
    const progression = [
      diatonicEvent('C', 'major', 0, { id: 'a', durationBeats: 2 }),
      diatonicEvent('C', 'major', 4, { id: 'b', durationBeats: 4 }),
    ];
    const session = sessionWith(progression);
    const candidate = phase1Candidate(session);

    expect(
      materializeCandidateProgression(session, {
        ...candidate,
        after: [{ ...candidate.after[0]!, durationBeats: 4 }, candidate.after[1]!],
      }),
    ).toMatchObject({ ok: false, reason: 'TOTAL_BEATS_CHANGED' });
    expect(
      materializeCandidateProgression(session, {
        ...candidate,
        after: [
          { ...candidate.after[0]!, durationBeats: 4 },
          { ...candidate.after[1]!, durationBeats: 2 },
        ],
      }),
    ).toMatchObject({ ok: false, reason: 'DURATION_CHANGED' });
  });

  it('rejects unsupported level/technique pairs and L1 root mutations', () => {
    const event = diatonicEvent('C', 'major', 0);
    const session = sessionWith([event]);
    const candidate = phase1Candidate(session);

    expect(
      materializeCandidateProgression(session, {
        ...candidate,
        level: 'reharm',
        technique: 'add_tension',
      }),
    ).toMatchObject({ ok: false, reason: 'UNSUPPORTED_CANDIDATE' });

    const moved = {
      ...candidate.after[0]!,
      symbol: { ...candidate.after[0]!.symbol, rootOffset: 2 },
    };
    expect(
      materializeCandidateProgression(session, {
        ...candidate,
        after: [moved],
        changes: [
          {
            kind: 'replace',
            index: 0,
            before: candidate.before[0]!,
            after: moved,
          },
        ],
      }),
    ).toMatchObject({ ok: false, reason: 'INVALID_CHANGE_SET' });
  });

  it('materializes L2 tension and slash candidates through technique policies', () => {
    const progression = [
      diatonicSeventhEvent('C', 'major', 0, { id: 'a' }),
      {
        ...diatonicSeventhEvent('C', 'major', 3, { id: 'b' }),
        isPro: true,
        category: 'variation' as const,
        variation: 'keep-me',
      },
      diatonicSeventhEvent('C', 'major', 4, { id: 'c' }),
    ];
    const session = sessionWith(progression);
    const candidates = l2Candidates(session);
    const tension = candidates.find((candidate) => candidate.technique === 'add_tension');
    const slash = candidates.find((candidate) => candidate.technique === 'slash_chord');
    expect(tension).toBeDefined();
    expect(slash).toBeDefined();

    const tensionResult = materializeCandidateProgression(session, tension!);
    const slashResult = materializeCandidateProgression(session, slash!);
    expect(tensionResult.ok).toBe(true);
    expect(slashResult.ok).toBe(true);
    if (!tensionResult.ok || !slashResult.ok) return;
    expect(tensionResult.value.map((event) => event.id)).toEqual(['a', 'b', 'c']);
    const changedSlash = slash!.changes[0];
    expect(changedSlash?.kind).toBe('replace');
    if (changedSlash?.kind !== 'replace') return;
    const slashEvent = slashResult.value[changedSlash.index]!;
    expect(slashEvent.bassOffset).toBe(changedSlash.after.symbol.bassOffset);
    expect(slashEvent.bassNote).toBeDefined();
    expect(progression[1]).toMatchObject({
      isPro: true,
      category: 'variation',
      variation: 'keep-me',
    });
  });

  it('rejects technique-specific attributes outside each L2 shape', () => {
    const progression = [
      diatonicSeventhEvent('C', 'major', 0, { id: 'a' }),
      diatonicSeventhEvent('C', 'major', 3, { id: 'b' }),
      diatonicSeventhEvent('C', 'major', 4, { id: 'c' }),
    ];
    const session = sessionWith(progression);
    const candidates = l2Candidates(session);
    const tension = candidates.find((candidate) => candidate.technique === 'add_tension')!;
    const slash = candidates.find((candidate) => candidate.technique === 'slash_chord')!;

    const tensionChange = tension.changes[0]!;
    expect(tensionChange.kind).toBe('replace');
    if (tensionChange.kind !== 'replace') return;
    const tensionAfter = {
      ...tensionChange.after,
      symbol: { ...tensionChange.after.symbol, bassOffset: 4 },
    };
    expect(
      materializeCandidateProgression(session, {
        ...tension,
        after: tension.after.map((chord, index) =>
          index === tensionChange.index ? tensionAfter : chord,
        ),
        changes: [
          {
            ...tensionChange,
            after: tensionAfter,
          },
          ...tension.changes.slice(1),
        ],
      }),
    ).toMatchObject({ ok: false, reason: 'INVALID_CHANGE_SET' });

    const slashChange = slash.changes[0]!;
    expect(slashChange.kind).toBe('replace');
    if (slashChange.kind !== 'replace') return;
    const slashAfter = {
      ...slashChange.after,
      symbol: {
        ...slashChange.after.symbol,
        suffix: 'm7',
        definitionId: 'm7',
      },
    };
    expect(
      materializeCandidateProgression(session, {
        ...slash,
        after: slash.after.map((chord, index) =>
          index === slashChange.index ? slashAfter : chord,
        ),
        changes: [{ ...slashChange, after: slashAfter }],
      }),
    ).toMatchObject({ ok: false, reason: 'INVALID_CHANGE_SET' });
  });

  it('rejects insertions and inconsistent change metadata', () => {
    const event = diatonicEvent('C', 'major', 0);
    const session = sessionWith([event]);
    const candidate = phase1Candidate(session);

    expect(
      materializeCandidateProgression(session, {
        ...candidate,
        changes: [
          {
            kind: 'insert_before',
            index: 0,
            inserted: candidate.after[0]!,
            resizedPrevious: candidate.before[0]!,
          },
        ],
      }),
    ).toMatchObject({ ok: false, reason: 'UNSUPPORTED_CHANGE_KIND' });
    expect(
      materializeCandidateProgression(session, {
        ...candidate,
        changes: [],
      }),
    ).toMatchObject({ ok: false, reason: 'INVALID_CHANGE_SET' });
  });
});
