import {
  computeChordContext,
  computeVisibleActions,
  type ChordContextInput,
  type VisibleActionsInput,
} from '@/features/editor/useEditorActions';
import { MAX_BARS } from '@/lib/progression';
import type { ChordDuration, ChordEvent } from '@/types';

function ev(id: string, durationBeats: ChordDuration = 4): ChordEvent {
  return {
    id,
    chordId: id,
    displayName: id,
    degreeLabel: 'I',
    function: 'tonic',
    durationBeats,
    isPro: false,
    rootOffset: 0,
    suffix: '',
  };
}

function base(progression: ChordEvent[], history: ChordEvent[][] = []): VisibleActionsInput {
  return { progression, history };
}

describe('computeVisibleActions', () => {
  describe('undo', () => {
    it('is hidden with no history and ready once there is history', () => {
      expect(computeVisibleActions(base([]), 'idle').undo.state).toBe('hidden');
      expect(computeVisibleActions(base([ev('C')], [[]]), 'idle').undo.state).toBe('ready');
    });
  });

  describe('loop', () => {
    it('is hidden for empty / single chord, ready for 2+', () => {
      expect(computeVisibleActions(base([]), 'idle').loop.state).toBe('hidden');
      expect(computeVisibleActions(base([ev('C')]), 'idle').loop.state).toBe('hidden');
      expect(computeVisibleActions(base([ev('C'), ev('G')]), 'idle').loop.state).toBe('ready');
    });
  });

  describe('play', () => {
    it('is empty mode when the progression is empty (Play no-ops; hint near library)', () => {
      const play = computeVisibleActions(base([]), 'idle').play;
      expect(play.state).toBe('ready');
      expect(play.mode).toBe('empty');
    });

    it('is play mode when stopped/paused with chords present', () => {
      expect(computeVisibleActions(base([ev('C')]), 'idle').play.mode).toBe('play');
      expect(computeVisibleActions(base([ev('C')]), 'paused').play.mode).toBe('play');
      expect(computeVisibleActions(base([ev('C')]), 'ready').play.mode).toBe('play');
    });

    it('is pause mode while playing', () => {
      expect(computeVisibleActions(base([ev('C')]), 'playing').play.mode).toBe('pause');
    });

    it('reports loading (never dead) while preparing', () => {
      const play = computeVisibleActions(base([ev('C')]), 'preparing').play;
      expect(play.state).toBe('loading');
      expect(play.mode).toBe('play');
    });
  });

  describe('metronome', () => {
    it('is hidden when the feature flag is off (unimplemented → hidden, not disabled)', () => {
      expect(
        computeVisibleActions(base([ev('C')]), 'idle', { metronome: false }).metronome.state,
      ).toBe('hidden');
    });

    it('becomes ready when the feature flag is on', () => {
      expect(
        computeVisibleActions(base([ev('C')]), 'idle', { metronome: true }).metronome.state,
      ).toBe('ready');
    });

    it('defaults to hidden (project ships with metronome off)', () => {
      expect(computeVisibleActions(base([ev('C')]), 'idle').metronome.state).toBe('hidden');
    });
  });

  describe('Chord Evolution progression entry', () => {
    it('is hidden when the flag is off', () => {
      expect(
        computeVisibleActions(base([ev('C')]), 'idle', {
          chordEvolution: false,
        }).evolutionProgression.state,
      ).toBe('hidden');
    });

    it('is ready only when the flag is on and progression is non-empty', () => {
      expect(
        computeVisibleActions(base([ev('C')]), 'idle', {
          chordEvolution: true,
        }).evolutionProgression.state,
      ).toBe('ready');
      expect(
        computeVisibleActions(base([]), 'idle', {
          chordEvolution: true,
        }).evolutionProgression.state,
      ).toBe('hidden');
    });
  });
});

describe('computeChordContext', () => {
  const ctx = (progression: ChordEvent[], selected: number): ChordContextInput => ({
    progression,
    selected,
  });

  it('is not visible with nothing selected', () => {
    const c = computeChordContext(ctx([ev('C'), ev('G')], -1));
    expect(c.visible).toBe(false);
    expect(c.canDelete).toBe(false);
    expect(c.canMoveLeft).toBe(false);
    expect(c.canMoveRight).toBe(false);
    expect(c.canEditDuration).toBe(false);
    expect(c.canEditVoicing).toBe(false);
  });

  it('is not visible when the selection is out of range', () => {
    expect(computeChordContext(ctx([ev('C')], 5)).visible).toBe(false);
  });

  it('allows delete / edit and move-right at the head, not move-left', () => {
    const c = computeChordContext(ctx([ev('C'), ev('G'), ev('Am')], 0));
    expect(c.visible).toBe(true);
    expect(c.canDelete).toBe(true);
    expect(c.canEditDuration).toBe(true);
    expect(c.canEditVoicing).toBe(true);
    expect(c.canMoveLeft).toBe(false);
    expect(c.canMoveRight).toBe(true);
  });

  it('allows move-left but not move-right at the tail', () => {
    const c = computeChordContext(ctx([ev('C'), ev('G'), ev('Am')], 2));
    expect(c.canMoveLeft).toBe(true);
    expect(c.canMoveRight).toBe(false);
  });

  it('allows duplicate only while the 16-bar cap has room', () => {
    const roomy = computeChordContext(ctx([ev('C'), ev('G')], 0));
    expect(roomy.canDuplicate).toBe(true);

    // Fill exactly to MAX_BARS (each chord = 4 beats = 1 bar): duplicate must be blocked.
    const full = Array.from({ length: MAX_BARS }, (_, i) => ev(`c${i}`));
    const c = computeChordContext(ctx(full, 0));
    expect(c.canDuplicate).toBe(false);
    // ...but delete/move stay available even when full.
    expect(c.canDelete).toBe(true);
  });

  it('shows the selected-chord Evolution entry only behind its flag', () => {
    const selected = ctx([ev('C'), ev('G')], 0);
    expect(computeChordContext(selected, { chordEvolution: false }).canEvolve).toBe(false);
    expect(computeChordContext(selected, { chordEvolution: true }).canEvolve).toBe(true);
    expect(
      computeChordContext(ctx([ev('C')], -1), {
        chordEvolution: true,
      }).canEvolve,
    ).toBe(false);
  });
});
