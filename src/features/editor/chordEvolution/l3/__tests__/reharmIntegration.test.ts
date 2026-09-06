import { applyEvolutionCandidate } from '@/features/editor/chordEvolution/apply';
import { buildEvolutionPreviewRequest } from '@/features/editor/chordEvolution/preview';
import { diatonicEvent, withoutEventId } from '@/features/editor/chordEvolution/testing/fixtures';
import { addChord, getSession, setSelected, startNew, undo } from '@/features/editor/session';
import { generateEvolutionCandidates } from '@/lib/harmony/evolution';

import { sessionToEvolutionContext } from '../../chordEventAdapter';

function startProgression(): void {
  startNew();
  addChord(withoutEventId(diatonicEvent('C', 'major', 0)));
  addChord(withoutEventId(diatonicEvent('C', 'major', 5)));
  addChord(withoutEventId(diatonicEvent('C', 'major', 3)));
  addChord(withoutEventId(diatonicEvent('C', 'major', 4)));
  setSelected(1);
}

function secondaryCandidate() {
  const candidate = generateEvolutionCandidates(
    sessionToEvolutionContext(getSession(), { kind: 'progression' }, 'reharm'),
  ).find((item) => item.technique === 'secondary_dominant');
  if (!candidate) throw new Error('Expected Secondary Dominant candidate');
  return candidate;
}

describe('L3 Preview / Apply / Undo integration', () => {
  it('previews without mutating Session or History', () => {
    startProgression();
    const before = getSession();
    const serialized = JSON.stringify(before);
    const candidate = secondaryCandidate();
    const preview = buildEvolutionPreviewRequest(before, candidate);
    expect(preview.ok).toBe(true);
    expect(getSession()).toBe(before);
    expect(JSON.stringify(getSession())).toBe(serialized);
    if (!preview.ok) return;
    expect(preview.value.totalBeats).toBe(
      candidate.after.reduce((sum, chord) => sum + chord.durationBeats, 0),
    );
  });

  it('applies once atomically, maps selection and undoes in one step', () => {
    startProgression();
    const before = getSession();
    const beforeSnapshot = before.progression.map((event) => ({
      ...event,
    }));
    const historyLength = before.history.length;
    const selectedEventId = before.progression[before.selected]!.id;
    const candidate = secondaryCandidate();

    expect(applyEvolutionCandidate(candidate)).toEqual({
      status: 'APPLIED',
      historyEntriesAdded: 1,
    });
    const applied = getSession();
    expect(applied.history).toHaveLength(historyLength + 1);
    expect(applied.progression[applied.selected]?.id).toBe(selectedEventId);
    expect(applied.progression).toHaveLength(before.progression.length + 1);
    expect(applyEvolutionCandidate(candidate)).toMatchObject({
      status: 'REJECTED',
      reason: 'STALE_BASELINE',
    });
    expect(getSession().history).toHaveLength(historyLength + 1);

    undo();
    expect(getSession().progression).toEqual(beforeSnapshot);
    expect(getSession().selected).toBe(1);
  });

  it('supports Apply -> Undo -> regenerate -> Apply without corruption', () => {
    startProgression();
    const first = secondaryCandidate();
    expect(applyEvolutionCandidate(first).status).toBe('APPLIED');
    undo();
    const second = secondaryCandidate();
    expect(second).toEqual(first);
    expect(applyEvolutionCandidate(second).status).toBe('APPLIED');
    expect(getSession().progression.reduce((sum, event) => sum + event.durationBeats, 0)).toBe(
      first.before.reduce((sum, chord) => sum + chord.durationBeats, 0),
    );
  });
});
