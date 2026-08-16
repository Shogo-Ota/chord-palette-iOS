import { gateCandidate, gateOfflineSnapshot, gateVoicing } from '../hardGate';
import { voicingsToSnapshot } from '../candidateFactory';

const C = { rootPc: 0, quality: 'major' as const, bassPc: 0, symbol: 'C' };
const GB = { rootPc: 7, quality: 'major' as const, bassPc: 11, symbol: 'G/B' };

describe('hardGate', () => {
  it('accepts a legal C voicing and rejects a duplicate MIDI pitch', () => {
    expect(gateVoicing([48, 52, 55, 60], C).ok).toBe(true);
    expect(gateVoicing([48, 48, 52, 55], C).ok).toBe(false);
  });

  it('rejects an illegal pitch class', () => {
    expect(gateVoicing([48, 52, 54, 55], C).ok).toBe(false);
  });

  it('allows inversion on a non-slash chord and enforces slash bass', () => {
    expect(gateVoicing([52, 55, 60, 64], C).ok).toBe(true);
    expect(gateVoicing([47, 50, 55, 59], GB).ok).toBe(true);
    expect(gateVoicing([43, 47, 50, 55], GB).ok).toBe(false);
  });

  it('rejects a length mismatch between voicings and chords', () => {
    expect(gateCandidate([[48, 52, 55]], [C, GB]).ok).toBe(false);
  });

  it('requires CC64 on/off and MIDI-range pitches on the offline snapshot', () => {
    const ok = voicingsToSnapshot(
      [
        [48, 52, 55],
        [47, 50, 55],
      ],
      ['C', 'G/B'],
    );
    expect(gateOfflineSnapshot(ok).ok).toBe(true);
    expect(
      gateOfflineSnapshot({
        ...ok,
        notes: [{ ...ok.notes[0], pitch: 140 }, ...ok.notes.slice(1)],
        controlChanges: [],
      }).ok,
    ).toBe(false);
  });
});
