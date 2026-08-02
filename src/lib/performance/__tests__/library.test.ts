/**
 * Library registration format (implementation_v1.01 Phase 12): a well-formed
 * relative pattern validates clean; the classic mistakes (absolute-pitch
 * thinking, out-of-range positions, missing provenance) are each caught.
 */

import { validateLibraryPattern, type LibraryPattern } from '@/lib/performance/library';

function sample(): LibraryPattern {
  return {
    id: 'ballad-piano-basic-1',
    name: 'Ballad piano, broken 1-5-10',
    sourceType: 'original',
    license: '自作（Chord Palette チーム）',
    style: 'ballad',
    rhythmFeel: 'straight',
    timeSignature: { beatsPerBar: 4, beatUnit: 4 },
    bpmRange: { min: 60, max: 90 },
    instrumentRole: 'piano',
    patternLengthBeats: 4,
    notes: [
      { posBeats: 0, chordToneIndex: 0, octaveOffset: 0, velocityRatio: 1, durationBeats: 2 },
      { posBeats: 1, chordToneIndex: 2, octaveOffset: 0, velocityRatio: 0.8, durationBeats: 1 },
      { posBeats: 2, chordToneIndex: 1, octaveOffset: 1, velocityRatio: 0.85, durationBeats: 2 },
    ],
    accentMap: [1, 0.5, 0.7, 0.4],
    tags: ['ballad', 'arpeggio'],
    qualityRating: 4,
    createdAt: '2026-08-02T00:00:00Z',
    updatedAt: '2026-08-02T00:00:00Z',
    version: 1,
  };
}

describe('validateLibraryPattern', () => {
  it('accepts a well-formed relative pattern', () => {
    expect(validateLibraryPattern(sample())).toEqual([]);
  });

  it('rejects a note outside the pattern window', () => {
    const p = sample();
    p.notes[0] = { ...p.notes[0], posBeats: 4 };
    expect(validateLibraryPattern(p)).not.toEqual([]);
  });

  it('rejects a missing license (provenance is mandatory)', () => {
    const p = { ...sample(), license: '' };
    expect(validateLibraryPattern(p).join()).toContain('license');
  });

  it('rejects absolute-pitch style values (negative degree, huge octave)', () => {
    const p = sample();
    p.notes[1] = { ...p.notes[1], chordToneIndex: -1, octaveOffset: 5 };
    expect(validateLibraryPattern(p).length).toBeGreaterThanOrEqual(2);
  });

  it('rejects an accent map that does not cover the pattern', () => {
    const p = { ...sample(), accentMap: [1, 0.5] };
    expect(validateLibraryPattern(p).join()).toContain('accentMap');
  });
});
