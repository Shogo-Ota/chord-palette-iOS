import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import { chordHarmonyFromEvent } from '../../humanTemplate/chordHarmony';
import { wrapPc } from '../../humanTemplate/degreeRoles';
import {
  VOICING_POSITIONS,
  buildCompactBaseVoicings,
  compactRegisterPolicy,
  isCompactHandModel,
  type BaseVoicing,
  type VoicingPosition,
} from '..';

function renderGolden(position: VoicingPosition, transpose = 0): BaseVoicing[][] {
  return GOLDEN_PROGRESSIONS.map((progression) => {
    const harmonies = progression.chords.map((chord) => {
      const harmony = chordHarmonyFromEvent(chord, progression.key);
      return {
        ...harmony,
        rootPc: wrapPc(harmony.rootPc + transpose),
        slashBassPc:
          harmony.slashBassPc == null ? undefined : wrapPc(harmony.slashBassPc + transpose),
      };
    });
    return buildCompactBaseVoicings(harmonies, { position, octaveShift: 0 });
  });
}

function expectedBassPc(voicing: BaseVoicing, position: VoicingPosition): number {
  if (voicing.harmony.slashBassPc != null) return wrapPc(voicing.harmony.slashBassPc);
  const uniquePcs = [
    ...new Set(
      voicing.harmony.chordIntervals.map((interval) => wrapPc(voicing.harmony.rootPc + interval)),
    ),
  ];
  const index = position === 'root' ? 0 : position === 'first' ? 1 : 2;
  return uniquePcs[Math.min(index, uniquePcs.length - 1)]!;
}

describe('Shared Compact Base Voicing Engine', () => {
  it.each(VOICING_POSITIONS)(
    '%s obeys harmony, hand-count, compact-register and inversion contracts',
    (position) => {
      for (const progression of renderGolden(position)) {
        expect(progression).toHaveLength(4);
        progression.forEach((voicing) => {
          const policy = compactRegisterPolicy(voicing.preference);
          const allowed = new Set(
            voicing.harmony.chordIntervals.map((interval) =>
              wrapPc(voicing.harmony.rootPc + interval),
            ),
          );
          if (voicing.harmony.slashBassPc != null) {
            allowed.add(wrapPc(voicing.harmony.slashBassPc));
          }

          expect(isCompactHandModel(voicing.notes, policy)).toBe(true);
          expect(voicing.notes.length).toBeGreaterThanOrEqual(3);
          expect(voicing.notes.length).toBeLessThanOrEqual(5);
          expect(new Set(voicing.notes.map((note) => note.pitch)).size).toBe(voicing.notes.length);
          expect(
            voicing.notes.every(
              (note) => note.pitch >= 0 && note.pitch <= 127 && allowed.has(note.pc),
            ),
          ).toBe(true);
          expect(voicing.notes.filter((note) => note.hand === 'LH')).toHaveLength(1);
          expect(voicing.notes.filter((note) => note.hand === 'RH').length).toBeGreaterThanOrEqual(
            2,
          );
          expect(voicing.notes.find((note) => note.isBass)?.pc).toBe(
            expectedBassPc(voicing, position),
          );
        });
      }
    },
  );

  it.each(VOICING_POSITIONS)('%s avoids octave jumps, including the loop boundary', (position) => {
    for (const progression of renderGolden(position)) {
      const closed = [...progression, progression[0]!];
      for (let index = 1; index < closed.length; index += 1) {
        const previous = closed[index - 1]!;
        const current = closed[index]!;
        const previousBass = previous.notes.find((note) => note.hand === 'LH')!.pitch;
        const currentBass = current.notes.find((note) => note.hand === 'LH')!.pitch;
        const previousTop = Math.max(...previous.notes.map((note) => note.pitch));
        const currentTop = Math.max(...current.notes.map((note) => note.pitch));
        expect(Math.abs(currentBass - previousBass)).toBeLessThan(12);
        expect(Math.abs(currentTop - previousTop)).toBeLessThan(12);
      }
    }
  });

  it('is deterministic and style-neutral by construction', () => {
    const progression = GOLDEN_PROGRESSIONS.find((item) => item.id === 'H')!;
    const harmonies = progression.chords.map((chord) =>
      chordHarmonyFromEvent(chord, progression.key),
    );
    const base = buildCompactBaseVoicings(harmonies);
    const pitches = base.map((voicing) => voicing.notes.map((note) => note.pitch));
    const styleConsumers = ['block', 'natural', 'city'].map(() =>
      buildCompactBaseVoicings(harmonies).map((voicing) => voicing.notes.map((note) => note.pitch)),
    );
    expect(styleConsumers).toEqual([pitches, pitches, pitches]);
  });

  it('keeps guide tones and defining altered fifths in advanced chords', () => {
    for (const progression of renderGolden('root')) {
      progression.forEach((voicing) => {
        const availableDegrees = new Set(
          voicing.harmony.chordIntervals.map((interval) => {
            const normalized = wrapPc(interval);
            if (normalized === 3 || normalized === 4) return 'third';
            if (normalized === 10 || normalized === 11) return 'seventh';
            if (normalized === 6 || normalized === 8) return 'altered-fifth';
            return 'other';
          }),
        );
        const sounding = new Set(
          voicing.notes.map((note) => {
            const normalized = wrapPc(note.interval);
            if (note.degree === 'third') return 'third';
            if (note.degree === 'seventh') return 'seventh';
            if (note.degree === 'fifth' && (normalized === 6 || normalized === 8)) {
              return 'altered-fifth';
            }
            return 'other';
          }),
        );
        for (const required of ['third', 'seventh', 'altered-fifth'] as const) {
          if (availableDegrees.has(required)) expect(sounding.has(required)).toBe(true);
        }
      });
    }
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])(
    'remains legal and compact after transposition +%i',
    (transpose) => {
      for (const progression of renderGolden('root', transpose)) {
        progression.forEach((voicing) => {
          const allowed = new Set(
            voicing.harmony.chordIntervals.map((interval) =>
              wrapPc(voicing.harmony.rootPc + interval),
            ),
          );
          if (voicing.harmony.slashBassPc != null) {
            allowed.add(wrapPc(voicing.harmony.slashBassPc));
          }
          expect(voicing.notes.every((note) => allowed.has(note.pc))).toBe(true);
          expect(isCompactHandModel(voicing.notes, compactRegisterPolicy(voicing.preference))).toBe(
            true,
          );
        });
      }
    },
  );
});
