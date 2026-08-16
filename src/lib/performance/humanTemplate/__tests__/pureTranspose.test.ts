import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import type { ChordEvent } from '@/types';

import { realizeHumanTemplate } from '../realize';
import { normalizeHumanTemplate, type RawHumanTemplateJson } from '../types';
import { progressionTransposeDelta } from '../pureTranspose';

function ev(rootOffset: number, suffix: string): ChordEvent {
  return {
    id: `pt-${rootOffset}-${suffix || 'maj'}`,
    chordId: `pt-${rootOffset}-${suffix || 'maj'}`,
    rootOffset,
    suffix,
    displayName: suffix ? `${rootOffset}${suffix}` : String(rootOffset),
    degreeLabel: 'I',
    function: 'tonic',
    isPro: false,
    durationBeats: 4,
  };
}

describe('progressionTransposeDelta', () => {
  it('A|F#m|D|E → C|Am|F|G is +3, never -9', () => {
    expect(progressionTransposeDelta([9, 6, 2, 4], [0, 9, 5, 7])).toBe(3);
  });

  it('C|Am|F|G → D|Bm|G|A is +2', () => {
    expect(progressionTransposeDelta([0, 9, 5, 7], [2, 11, 7, 9])).toBe(2);
  });

  it('Identity is 0', () => {
    expect(progressionTransposeDelta([9, 6, 2, 4], [9, 6, 2, 4])).toBe(0);
  });

  it('rejects a mixed (not pure) progression', () => {
    expect(progressionTransposeDelta([9, 6, 2, 4], [0, 9, 5, 9])).toBeUndefined();
  });
});

describe('Pure Transpose does not wrap per bar', () => {
  it('moves every A-major teacher note by +3 onto C|Am|F|G', () => {
    const raw: RawHumanTemplateJson = {
      id: 'qa.a-to-c',
      sourceId: 'QA_A',
      meter: { beatsPerBar: 4, beatUnit: 4 },
      timeline: { loopBars: 4 },
      sourceChords: {
        loop: [
          { musicalBarInLoop: 1, symbol: 'A', rootPc: 9, quality: 'maj', chordIntervals: [0, 4, 7] },
          { musicalBarInLoop: 2, symbol: 'F#m', rootPc: 6, quality: 'min', chordIntervals: [0, 3, 7] },
          { musicalBarInLoop: 3, symbol: 'D', rootPc: 2, quality: 'maj', chordIntervals: [0, 4, 7] },
          { musicalBarInLoop: 4, symbol: 'E', rootPc: 4, quality: 'maj', chordIntervals: [0, 4, 7] },
        ],
      },
      attacks: [
        {
          musicalBarInLoop: 1,
          beatInMusicalBar: 0,
          notes: [
            { absolutePitch: 33, durationBeats: 1, velocity: 80 },
            { absolutePitch: 56, durationBeats: 1, velocity: 70 },
          ],
        },
        {
          musicalBarInLoop: 2,
          beatInMusicalBar: 0,
          notes: [{ absolutePitch: 42, durationBeats: 1, velocity: 75 }],
        },
        {
          musicalBarInLoop: 3,
          beatInMusicalBar: 0,
          notes: [{ absolutePitch: 50, durationBeats: 1, velocity: 72 }],
        },
        {
          musicalBarInLoop: 4,
          beatInMusicalBar: 0,
          notes: [{ absolutePitch: 52, durationBeats: 1, velocity: 77 }],
        },
      ],
    };
    const template = normalizeHumanTemplate(raw, 'normal');
    const target = progressionToPerfChords(
      [ev(0, ''), ev(9, 'm'), ev(5, ''), ev(7, '')],
      'C',
    );
    const events = realizeHumanTemplate(template, target, {
      seed: 1,
      pitchMode: 'teacherFidelity',
    });
    expect(events.map((e) => e.pitch)).toEqual([36, 59, 45, 53, 55]);
    expect(events.map((e) => e.velocity)).toEqual([80, 70, 75, 72, 77]);
    expect(events.map((e) => e.timeBeat)).toEqual([0, 0, 4, 8, 12]);
  });
});
