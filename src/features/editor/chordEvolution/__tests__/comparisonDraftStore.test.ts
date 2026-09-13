import {
  clearComparisonDraft,
  getComparisonDraft,
  prepareComparisonDraft,
  publishComparisonDraft,
  resolveComparisonDraft,
  subscribeComparisonDraft,
} from '@/features/editor/chordEvolution/comparisonDraftStore';
import { applyEvolutionCandidate } from '@/features/editor/chordEvolution/apply';
import {
  diatonicEvent,
  phase1Candidate,
  withoutEventId,
} from '@/features/editor/chordEvolution/testing/fixtures';
import {
  addChord,
  getSession,
  setDuration,
  setSelected,
  startNew,
} from '@/features/editor/session';

function startTriadSession(): void {
  startNew();
  addChord(withoutEventId(diatonicEvent('C', 'major', 0)));
  addChord(withoutEventId(diatonicEvent('C', 'major', 3)));
  addChord(withoutEventId(diatonicEvent('C', 'major', 4)));
  setSelected(1);
}

describe('comparisonDraftStore', () => {
  beforeEach(() => {
    clearComparisonDraft();
    startTriadSession();
  });

  it('prepares immutable base/variant snapshots without mutating Session or candidate', () => {
    const beforeProgression = getSession().progression;
    const beforeHistory = getSession().history;
    const candidate = phase1Candidate(getSession());
    const candidateBefore = JSON.stringify(candidate);

    const result = prepareComparisonDraft(getSession(), candidate);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getSession().progression).toBe(beforeProgression);
    expect(getSession().history).toBe(beforeHistory);
    expect(JSON.stringify(candidate)).toBe(candidateBefore);
    expect(result.value.base.progression).not.toBe(beforeProgression);
    expect(result.value.variant.progression).not.toBe(candidate.after);
    expect(result.value.compatibility.supported).toBe(true);
    expect(result.value.changes.length).toBeGreaterThan(0);
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it('resolves only after the exact prepared variant is successfully applied', () => {
    const candidate = phase1Candidate(getSession());
    const prepared = prepareComparisonDraft(getSession(), candidate);
    if (!prepared.ok) throw new Error(prepared.reason);

    publishComparisonDraft(prepared.value);
    expect(resolveComparisonDraft(getSession()).status).toBe('stale');

    expect(applyEvolutionCandidate(candidate).status).toBe('APPLIED');
    expect(resolveComparisonDraft(getSession())).toMatchObject({
      status: 'available',
      draft: { candidateId: candidate.id },
    });
    expect(resolveComparisonDraft({ ...getSession(), projectId: 'p-first-save' })).toMatchObject({
      status: 'available',
    });
  });

  it('reports a later Editor mutation as stale instead of rebasing', () => {
    const candidate = phase1Candidate(getSession());
    const prepared = prepareComparisonDraft(getSession(), candidate);
    if (!prepared.ok) throw new Error(prepared.reason);
    applyEvolutionCandidate(candidate);
    publishComparisonDraft(prepared.value);

    setDuration(2);
    expect(resolveComparisonDraft(getSession())).toMatchObject({
      status: 'stale',
      draft: { draftId: prepared.value.draftId },
    });
  });

  it('publishes and clears one stable external-store snapshot', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeComparisonDraft(listener);
    const candidate = phase1Candidate(getSession());
    const prepared = prepareComparisonDraft(getSession(), candidate);
    if (!prepared.ok) throw new Error(prepared.reason);

    publishComparisonDraft(prepared.value);
    expect(getComparisonDraft()).toBe(prepared.value);
    clearComparisonDraft();
    clearComparisonDraft();
    unsubscribe();

    expect(getComparisonDraft()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
