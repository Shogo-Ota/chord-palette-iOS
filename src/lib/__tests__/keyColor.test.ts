import { distinctKeys, eventKey, isMultiKey, keyColorSlots } from '@/lib/keyColor';
import type { ChordEvent, MajorKey } from '@/types';

function ev(keyContext?: MajorKey): ChordEvent {
  return {
    id: Math.random().toString(36).slice(2),
    chordId: 'c',
    displayName: 'C',
    degreeLabel: 'I',
    function: 'tonic',
    durationBeats: 4,
    isPro: false,
    rootOffset: 0,
    suffix: '',
    keyContext,
  };
}

describe('keyColor', () => {
  it('falls back to the session key when an event has no keyContext', () => {
    expect(eventKey(ev(undefined), 'G')).toBe('G');
    expect(eventKey(ev('D'), 'G')).toBe('D');
  });

  it('lists distinct keys in order of first appearance', () => {
    const prog = [ev('C'), ev('C'), ev('G'), ev('C'), ev('A')];
    expect(distinctKeys(prog, 'C')).toEqual(['C', 'G', 'A']);
  });

  it('treats missing keyContext as the fallback key for distinctness', () => {
    const prog = [ev(undefined), ev('G')];
    expect(distinctKeys(prog, 'C')).toEqual(['C', 'G']);
  });

  it('assigns slot 0 to the base key and increments per new key', () => {
    const prog = [ev('C'), ev('G'), ev('A')];
    const slots = keyColorSlots(prog, 'C');
    expect(slots.get('C')).toBe(0);
    expect(slots.get('G')).toBe(1);
    expect(slots.get('A')).toBe(2);
  });

  it('reports single vs multi key correctly', () => {
    expect(isMultiKey([ev('C'), ev('C')], 'C')).toBe(false);
    expect(isMultiKey([], 'C')).toBe(false);
    expect(isMultiKey([ev('C'), ev('G')], 'C')).toBe(true);
  });
});
