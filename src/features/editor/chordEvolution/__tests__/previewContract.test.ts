import { buildEvolutionPreviewRequest } from '@/features/editor/chordEvolution/preview';
import {
  phase1Candidate,
  diatonicEvent,
  withoutEventId,
} from '@/features/editor/chordEvolution/testing/fixtures';
import { addChord, getSession, setSelected, startNew } from '@/features/editor/session';
import { sessionToPlaybackRequest } from '@/features/editor/playback';

describe('Chord Evolution preview contract', () => {
  beforeEach(() => {
    startNew();
    addChord(withoutEventId(diatonicEvent('C', 'major', 0)));
    addChord(withoutEventId(diatonicEvent('C', 'major', 4)));
    setSelected(1);
  });

  it('does not mutate Session, history, selection or persisted-state fields', () => {
    const before = getSession();
    const serialized = JSON.stringify(before);
    const history = before.history;
    const progression = before.progression;
    const candidate = phase1Candidate(before);

    const result = buildEvolutionPreviewRequest(before, candidate);

    expect(result.ok).toBe(true);
    expect(getSession()).toBe(before);
    expect(getSession().history).toBe(history);
    expect(getSession().progression).toBe(progression);
    expect(getSession().selected).toBe(1);
    expect(JSON.stringify(getSession())).toBe(serialized);
  });

  it('builds the same existing-playback request for the same candidate', () => {
    const session = getSession();
    const candidate = phase1Candidate(session);

    const first = buildEvolutionPreviewRequest(session, candidate);
    const second = buildEvolutionPreviewRequest(session, candidate);

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.countIn).toBeUndefined();
    expect(first.value.totalBeats).toBe(8);
    expect(first.value.chordEvents.length).toBeGreaterThan(0);
  });

  it('renders candidate harmony without temporarily applying it', () => {
    const session = getSession();
    const candidate = phase1Candidate(session);
    const currentRequest = sessionToPlaybackRequest(session, false);
    const preview = buildEvolutionPreviewRequest(session, candidate);

    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.value.planSignature).not.toBe(currentRequest.planSignature);
    expect(getSession().progression.map((event) => event.suffix)).toEqual(['', '']);
  });

  it('rejects a candidate generated from an older session state', () => {
    const before = getSession();
    const candidate = phase1Candidate(before);
    addChord(withoutEventId(diatonicEvent('C', 'major', 3)));
    const afterEdit = getSession();
    const serialized = JSON.stringify(afterEdit);

    expect(buildEvolutionPreviewRequest(afterEdit, candidate)).toMatchObject({
      ok: false,
      reason: 'STALE_BASELINE',
    });
    expect(JSON.stringify(getSession())).toBe(serialized);
  });
});
