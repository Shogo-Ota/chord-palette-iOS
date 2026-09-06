import { applyEvolutionCandidate } from '@/features/editor/chordEvolution/apply';
import { buildEvolutionPreviewRequest } from '@/features/editor/chordEvolution/preview';
import {
  diatonicSeventhEvent,
  l2Candidates,
  withoutEventId,
} from '@/features/editor/chordEvolution/testing/fixtures';
import { addChord, getSession, setSelected, startNew, undo } from '@/features/editor/session';

function startL2Session(): void {
  startNew();
  addChord(withoutEventId(diatonicSeventhEvent('C', 'major', 0)));
  addChord(withoutEventId(diatonicSeventhEvent('C', 'major', 3)));
  addChord(withoutEventId(diatonicSeventhEvent('C', 'major', 4)));
  setSelected(1);
}

describe('L2 preview/apply contracts', () => {
  beforeEach(startL2Session);

  it.each(['add_tension', 'slash_chord'] as const)(
    'previews %s without changing session or history',
    (technique) => {
      const before = getSession();
      const snapshot = JSON.stringify(before);
      const candidate = l2Candidates(before).find((item) => item.technique === technique);
      expect(candidate).toBeDefined();

      const result = buildEvolutionPreviewRequest(before, candidate!);
      expect(result.ok).toBe(true);
      expect(getSession()).toBe(before);
      expect(JSON.stringify(getSession())).toBe(snapshot);
    },
  );

  it.each(['add_tension', 'slash_chord'] as const)(
    'applies %s atomically and restores it with one undo',
    (technique) => {
      const before = getSession();
      const progressionSnapshot = before.progression.map((event) => ({
        ...event,
        ...(event.rootSpelling ? { rootSpelling: { ...event.rootSpelling } } : {}),
      }));
      const historyLength = before.history.length;
      const candidate = l2Candidates(before).find((item) => item.technique === technique);
      expect(candidate).toBeDefined();

      expect(applyEvolutionCandidate(candidate!)).toEqual({
        status: 'APPLIED',
        historyEntriesAdded: 1,
      });
      expect(getSession().history).toHaveLength(historyLength + 1);
      undo();
      expect(getSession().progression).toEqual(progressionSnapshot);
      expect(getSession().selected).toBe(1);
    },
  );
});
