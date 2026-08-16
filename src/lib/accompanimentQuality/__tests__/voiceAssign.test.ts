import { assignVoices } from '../voiceAssign';

describe('assignVoices', () => {
  it('matches common tones before leaping', () => {
    const a = assignVoices([48, 52, 55, 60], [48, 52, 57, 60]);
    expect(a.pairs.filter((p) => p.cost === 0).length).toBe(3);
    expect(a.totalCost).toBe(2);
    expect(a.crossingCount).toBe(0);
  });

  it('does not compare by sort index when a crossing would be cheaper to avoid', () => {
    const a = assignVoices([48, 64], [64, 48]);
    expect(a.totalCost).toBe(0);
    expect(a.crossingCount).toBe(0);
  });

  it('leaves extras unmatched on the larger side', () => {
    const a = assignVoices([48, 52, 55, 60], [48, 52, 55]);
    expect(a.pairs).toHaveLength(3);
    expect(a.unmatchedFrom).toHaveLength(1);
    expect(a.unmatchedTo).toHaveLength(0);
  });
});
