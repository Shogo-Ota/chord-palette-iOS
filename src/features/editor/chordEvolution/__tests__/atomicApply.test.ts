import {
  applyEvolutionCandidate,
  prepareEvolutionApply,
} from '@/features/editor/chordEvolution/apply';
import { sessionToEvolutionContext } from '@/features/editor/chordEvolution/chordEventAdapter';
import {
  diatonicEvent,
  phase1Candidate,
  withoutEventId,
} from '@/features/editor/chordEvolution/testing/fixtures';
import {
  addChord,
  getSession,
  replaceProgressionAtomically,
  setDuration,
  setSelected,
  startNew,
  undo,
} from '@/features/editor/session';

describe('Chord Evolution atomic apply', () => {
  beforeEach(() => {
    startNew();
    addChord(withoutEventId(diatonicEvent('C', 'major', 0)));
    addChord(withoutEventId(diatonicEvent('C', 'major', 4)));
    setSelected(1);
  });

  it('applies Candidate.after in one atomic operation', () => {
    const before = getSession();
    const historyLength = before.history.length;
    const candidate = phase1Candidate(before);

    expect(applyEvolutionCandidate(candidate)).toEqual({
      status: 'APPLIED',
      historyEntriesAdded: 1,
    });

    const after = getSession();
    expect(
      sessionToEvolutionContext(after, { kind: 'progression' }, 'seventh').progression,
    ).toEqual(candidate.after);
    expect(after.history).toHaveLength(historyLength + 1);
    expect(after.selected).toBe(1);
    expect(after.dirty).toBe(true);
  });

  it('restores the exact pre-apply progression with one Undo', () => {
    const before = getSession().progression.map((event) => ({
      ...event,
      ...(event.rootSpelling ? { rootSpelling: { ...event.rootSpelling } } : {}),
    }));
    const candidate = phase1Candidate(getSession());

    applyEvolutionCandidate(candidate);
    undo();

    expect(getSession().progression).toEqual(before);
    expect(getSession().selected).toBe(1);
  });

  it('adds one history entry for a candidate changing multiple chords', () => {
    const beforeHistory = getSession().history.length;
    const candidate = phase1Candidate(getSession());
    expect(candidate.changes.length).toBe(2);

    applyEvolutionCandidate(candidate);

    expect(getSession().history.length - beforeHistory).toBe(1);
  });

  it('preserves duration, order, event identity and total beats', () => {
    const before = getSession().progression;
    const ids = before.map((event) => event.id);
    const durations = before.map((event) => event.durationBeats);
    const total = durations.reduce((sum, beats) => sum + beats, 0);
    const candidate = phase1Candidate(getSession());

    applyEvolutionCandidate(candidate);

    const after = getSession().progression;
    expect(after.map((event) => event.id)).toEqual(ids);
    expect(after.map((event) => event.durationBeats)).toEqual(durations);
    expect(after.reduce((sum, event) => sum + event.durationBeats, 0)).toBe(total);
  });

  it('rejects a stale candidate without adding history', () => {
    const candidate = phase1Candidate(getSession());
    setDuration(2);
    const historyLength = getSession().history.length;
    const progression = getSession().progression;

    expect(applyEvolutionCandidate(candidate)).toMatchObject({
      status: 'REJECTED',
      reason: 'STALE_BASELINE',
    });
    expect(getSession().history).toHaveLength(historyLength);
    expect(getSession().progression).toBe(progression);
  });

  it('rejects no-op and malformed candidates without adding history', () => {
    const candidate = phase1Candidate(getSession());
    const noOp = {
      ...candidate,
      after: candidate.before,
      changes: [],
    };
    const malformed = {
      ...candidate,
      changes: [],
    };
    const historyLength = getSession().history.length;

    expect(prepareEvolutionApply(getSession(), noOp)).toMatchObject({
      ok: false,
      reason: 'NO_CHANGES',
    });
    expect(applyEvolutionCandidate(malformed)).toMatchObject({
      status: 'REJECTED',
      reason: 'INVALID_CHANGE_SET',
    });
    expect(getSession().history).toHaveLength(historyLength);
  });

  it('guards the Session transaction against a changed progression reference', () => {
    const observed = getSession().progression;
    addChord(withoutEventId(diatonicEvent('C', 'major', 3)));
    const historyLength = getSession().history.length;
    const active = getSession().progression;

    expect(replaceProgressionAtomically(observed, observed, 0)).toBe(false);
    expect(getSession().history).toHaveLength(historyLength);
    expect(getSession().progression).toBe(active);
  });
});
