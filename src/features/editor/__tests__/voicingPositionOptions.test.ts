import {
  OFFERED_VOICING_POSITIONS,
  VOICING_POSITION_LABELS,
  voicingPositionBadge,
  voicingPositionOptions,
} from '@/features/editor/voicingPositionOptions';
import { VOICING_POSITIONS } from '@/lib/performance/baseVoicing';

describe('inversions the editor offers', () => {
  it('offers exactly two, default first', () => {
    expect([...OFFERED_VOICING_POSITIONS]).toEqual(['root', 'first']);
    expect(voicingPositionOptions('root')).toEqual([
      { key: 'root', label: '基本形' },
      { key: 'first', label: '1st' },
    ]);
    expect(voicingPositionOptions('first')).toHaveLength(2);
  });

  /**
   * The engine keeps all three positions. Withdrawing one from the picker must not
   * narrow the domain, or a saved project would stop being expressible.
   */
  it('does not narrow what the engine accepts', () => {
    expect([...VOICING_POSITIONS]).toEqual(['root', 'first', 'second']);
    for (const position of VOICING_POSITIONS) {
      expect(VOICING_POSITION_LABELS[position]).toBeTruthy();
    }
  });

  /**
   * A chord saved before second inversion was withdrawn still holds it. The picker has to
   * show that, otherwise the control claims the chord is in a position it is not.
   */
  it('shows a withdrawn position the chord still holds, and only for that chord', () => {
    expect(voicingPositionOptions('second')).toEqual([
      { key: 'root', label: '基本形' },
      { key: 'first', label: '1st' },
      { key: 'second', label: '2nd' },
    ]);
    expect(voicingPositionOptions('root').map((o) => o.key)).not.toContain('second');
  });

  it('always includes the current position so the control can render it as selected', () => {
    for (const position of VOICING_POSITIONS) {
      expect(voicingPositionOptions(position).map((o) => o.key)).toContain(position);
    }
  });

  it('badges only the non-default positions', () => {
    expect(voicingPositionBadge('root')).toBe('');
    expect(voicingPositionBadge('first')).toBe('1st');
    expect(voicingPositionBadge('second')).toBe('2nd');
  });
});
