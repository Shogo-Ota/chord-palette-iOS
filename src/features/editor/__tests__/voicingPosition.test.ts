import {
  chordPreviewMidiNotes,
  chordPreviewRequest,
} from '@/features/editor/playback';
import {
  addChord,
  getSession,
  setAccompaniment,
  setSelected,
  setSelectedVoicingPosition,
  startNew,
} from '@/features/editor/session';
import { VOICING_POSITIONS } from '@/lib/performance/baseVoicing';

function pc(pitch: number): number {
  return ((pitch % 12) + 12) % 12;
}

describe('editor voicing position', () => {
  beforeEach(() => startNew());

  it('is stored on the selected chord and survives Style changes', () => {
    addChord({
      chordId: 'C',
      displayName: 'C',
      degreeLabel: 'I',
      function: 'tonic',
      durationBeats: 4,
      isPro: false,
      rootOffset: 0,
      suffix: '',
      definitionId: 'maj',
    });
    setSelected(0);
    expect(getSession().progression[0]?.voicingPosition).toBe('root');

    setSelectedVoicingPosition('first');
    setAccompaniment('city', 'city.type1');

    expect(getSession().progression[0]?.voicingPosition).toBe('first');
    expect(getSession()).toMatchObject({ accompanimentPattern: 'city', dirty: true });
  });

  it.each(VOICING_POSITIONS)('uses %s for single-chord preview', (position) => {
    const notes = chordPreviewMidiNotes(
      { rootOffset: 0, suffix: '', definitionId: 'maj' },
      'C',
      0,
      position,
    );
    const expectedBassPc = position === 'root' ? 0 : position === 'first' ? 4 : 7;

    expect(pc(notes[0]!)).toBe(expectedBassPc);
    expect(notes.every((pitch) => [0, 4, 7].includes(pc(pitch)))).toBe(true);
  });

  it('keeps slash bass authoritative and defaults omitted callers to root', () => {
    const slash = chordPreviewMidiNotes(
      { rootOffset: 7, suffix: '', bassOffset: 11 },
      'C',
      0,
      'second',
    );
    expect(pc(slash[0]!)).toBe(11);

    const chord = { rootOffset: 0, suffix: '', definitionId: 'maj' };
    expect(chordPreviewRequest(chord, 'C', 100, 'piano').midiNotes).toEqual(
      chordPreviewMidiNotes(chord, 'C', 0, 'root'),
    );
  });

  it('prefers the placed chord position over a legacy caller fallback', () => {
    const chord = {
      rootOffset: 0,
      suffix: '',
      definitionId: 'maj',
      voicingPosition: 'second' as const,
    };
    const notes = chordPreviewMidiNotes(chord, 'C', 0, 'first');
    expect(pc(notes[0]!)).toBe(7);
  });
});
