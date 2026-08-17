import { generatePerformance } from '../../PerformanceEngine';
import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import type { ChordEvent } from '@/types';

import {
  HUMAN_TEMPLATE_ARPEGGIO_P1_C10,
  HUMAN_TEMPLATE_BALLAD_P1_C7,
  HUMAN_TEMPLATE_NORMAL_P1_A1,
  HUMAN_TEMPLATE_VARIATION_P1_C12,
  humanTemplateById,
  humanTemplateIdForPattern,
  PRODUCTION_HUMAN_TEMPLATE_IDS,
  realizeHumanTemplate,
  validateHumanTemplateOutput,
} from '../index';

function ev(rootOffset: number, suffix: string, definitionId?: string): ChordEvent {
  return {
    id: `t-${rootOffset}-${suffix}`,
    chordId: `t-${rootOffset}-${suffix}`,
    rootOffset,
    suffix,
    definitionId,
    displayName: suffix ? `${rootOffset}${suffix}` : String(rootOffset),
    degreeLabel: 'I',
    function: 'tonic',
    isPro: false,
    durationBeats: 4,
  };
}

const REPRESENTATIVE_PROGRESSIONS: {
  name: string;
  chords: ChordEvent[];
}[] = [
  { name: 'major triad', chords: [ev(0, '')] },
  { name: 'minor triad', chords: [ev(9, 'm')] },
  { name: 'maj7', chords: [ev(0, 'maj7')] },
  { name: 'dominant7', chords: [ev(7, '7')] },
  { name: 'm7', chords: [ev(9, 'm7')] },
  { name: 'add9', chords: [ev(0, 'add9')] },
];

describe('humanTemplate catalog', () => {
  it('loads production minimal set', () => {
    expect(humanTemplateById(HUMAN_TEMPLATE_NORMAL_P1_A1)?.category).toBe('normal');
    expect(humanTemplateById(HUMAN_TEMPLATE_BALLAD_P1_C7)?.category).toBe('ballad');
    expect(humanTemplateById(HUMAN_TEMPLATE_ARPEGGIO_P1_C10)?.category).toBe('arpeggio');
    expect(humanTemplateById(HUMAN_TEMPLATE_VARIATION_P1_C12)?.category).toBe('variation');
  });

  it('maps accompaniment patterns to templates', () => {
    expect(humanTemplateIdForPattern('natural')).toBe(HUMAN_TEMPLATE_NORMAL_P1_A1);
    expect(humanTemplateIdForPattern('block')).toBeUndefined();
    expect(humanTemplateIdForPattern('relaxed')).toBe(HUMAN_TEMPLATE_BALLAD_P1_C7);
    expect(humanTemplateIdForPattern('arpeggio')).toBe(HUMAN_TEMPLATE_VARIATION_P1_C12);
    expect(humanTemplateIdForPattern('driving')).toBeUndefined();
  });
});

describe('strict v2 human template realize', () => {
  // Every take in the catalog, not just the three that shipped first: a Type the
  // Style screen offers must transplant cleanly onto any chord quality.
  for (const templateId of PRODUCTION_HUMAN_TEMPLATE_IDS) {
    describe(templateId, () => {
      for (const { name, chords } of REPRESENTATIVE_PROGRESSIONS) {
        it(`passes auto validation for ${name}`, () => {
          const template = humanTemplateById(templateId)!;
          const perf = progressionToPerfChords(chords, 'C');
          const events = realizeHumanTemplate(template, perf, {
            seed: 42,
            velocityCenter: 68,
            // This validator is the lossless Teacher Identity gate. Production
            // userChord mode intentionally realizes atomic groups from Shared Base.
            pitchMode: 'teacherFidelity',
          });
          expect(events.length).toBeGreaterThan(0);
          const spans = perf.map((c) => ({
            startBeat: c.startBeat,
            durationBeats: c.durationBeats,
            harmony: c.harmony!,
          }));
          const result = validateHumanTemplateOutput(template, spans, events);
          expect(result.timingPreserved).toBe(true);
          expect(result.durationPreserved).toBe(true);
          expect(result.velocityPreserved).toBe(true);
          // Teacher chromatics are kept. Chord-tone legality is not the Identity gate.
        });
      }
    });
  }
});

describe('generatePerformance × humanTemplateId', () => {
  it('emits human template notes for relaxed (ballad)', () => {
    const chords = progressionToPerfChords([ev(0, ''), ev(9, 'm'), ev(5, ''), ev(7, '')], 'C');
    const notes = generatePerformance(
      { chords, bpm: 72, seed: 1 },
      {
        styleId: 'relaxed',
        grooveId: 'pop8',
        accompanimentStyle: 'ballad',
        humanTemplateId: HUMAN_TEMPLATE_BALLAD_P1_C7,
        drums: false,
      },
    );
    const chordNotes = notes.filter((n) => n.trackId === 'chord');
    expect(chordNotes.length).toBeGreaterThan(20);
  });
});
