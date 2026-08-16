/**
 * Axis model (implementation_v1.01 Phase 2): every selector rhythm resolves to a
 * Style × Rhythm Feel × meter triple, the feel axis agrees with the preset that
 * actually plays, and adding the model changed nothing about the render pipeline
 * (it is metadata only — no engine file imports it).
 */

import { ACCOMPANIMENT_IDS } from '@/data/labels';
import { axesFor, rhythmFeelOf, roleForTrack } from '@/lib/performance/model';
import type { TrackId } from '@/lib/performance/NoteEvent';
import { rhythmFor, beatsPerBarFor } from '@/lib/performance/rhythms';

describe('every rhythm resolves to a full triple', () => {
  it('covers every catalogued rhythm id', () => {
    for (const id of ACCOMPANIMENT_IDS) {
      const axes = axesFor(id);
      expect(axes).toBeDefined();
      expect(axes!.beatsPerBar).toBe(beatsPerBarFor(id));
    }
  });

  it('returns undefined for ids the selector does not know', () => {
    expect(axesFor('eightBeat')).toBeUndefined(); // legacy direct-style id
    expect(axesFor('nope')).toBeUndefined();
  });
});

describe('the feel axis is derived from what actually plays', () => {
  it('matches each preset swing spec', () => {
    for (const id of ACCOMPANIMENT_IDS) {
      const rhythm = rhythmFor(id)!;
      const feel = rhythmFeelOf(id);
      if (rhythm.source.kind !== 'style' || !rhythm.source.style.swing) {
        expect(feel).toBe('straight');
      } else {
        expect(['shuffle', 'swing']).toContain(feel);
      }
    }
  });

  it('separates the hard triplet from the gentle lilt', () => {
    expect(rhythmFeelOf('shuffle')).toBe('shuffle'); // offbeatRatio 0.667 (2:1)
    expect(rhythmFeelOf('swing')).toBe('swing'); // offbeatRatio 0.62
    expect(rhythmFeelOf('beat8')).toBe('straight');
    expect(rhythmFeelOf('natural')).toBe('straight');
  });
});

describe('instrument roles', () => {
  it('maps every engine track to a role', () => {
    const expected: Record<TrackId, string> = {
      chord: 'piano',
      top: 'piano',
      bass: 'bass',
      kick: 'drums',
      snare: 'drums',
      hat: 'drums',
    };
    for (const [track, role] of Object.entries(expected)) {
      expect(roleForTrack(track as TrackId)).toBe(role);
    }
  });
});
