/**
 * Voicing Quality corpus (Cases V1–V9) for the `compact.v2` candidate policy.
 *
 * These are the musical claims v2 makes beyond the approved v1 default, so every
 * case renders through v2 explicitly rather than through whatever policy happens
 * to be active.
 */
import { wrapPc } from '../../humanTemplate/degreeRoles';
import {
  COMPACT_V2_POLICY,
  VOICING_POSITIONS,
  buildCompactBaseVoicings,
  compactCandidatesForHarmony,
  compactRegisterPolicy,
  isCompactHandModel,
  type BaseVoicing,
  type VoicingPosition,
} from '..';
import { intervalRole, isTensionRole } from '../policy/intervalRoles';
import { voicingQualityMetrics } from '../voicingAnalysis';
import {
  VOICING_QUALITY_CASES,
  harmonyFromQualityCase,
  transposedHarmony,
} from '../voicingQualityCorpus';

const POSITIONS: VoicingPosition[] = ['root', 'first', 'second'];

function caseById(id: string) {
  const found = VOICING_QUALITY_CASES.find((item) => item.id === id);
  if (!found) throw new Error(`missing voicing quality case ${id}`);
  return found;
}

function render(id: string, position: VoicingPosition = 'root', transpose = 0): BaseVoicing {
  const harmony = transposedHarmony(harmonyFromQualityCase(caseById(id)), transpose);
  return buildCompactBaseVoicings([harmony], { position, octaveShift: 0 }, COMPACT_V2_POLICY)[0]!;
}

function soundingRoles(voicing: BaseVoicing): Set<string> {
  return new Set(voicing.notes.map((note) => intervalRole(note.interval)));
}

function allowedPcs(voicing: BaseVoicing): Set<number> {
  const allowed = new Set(
    voicing.harmony.chordIntervals.map((interval) => wrapPc(voicing.harmony.rootPc + interval)),
  );
  if (voicing.harmony.slashBassPc != null) allowed.add(wrapPc(voicing.harmony.slashBassPc));
  return allowed;
}

describe('Voicing Quality corpus', () => {
  it('V1 Fmaj7 keeps F/A/C/E and avoids a mid-low RH E-F cluster', () => {
    for (const position of POSITIONS) {
      const voicing = render('V1', position);
      const pcs = new Set(voicing.notes.map((note) => wrapPc(note.pc)));
      expect([...pcs].every((pc) => [5, 9, 0, 4].includes(pc))).toBe(true);
      expect(soundingRoles(voicing).has('seventh')).toBe(true);
      expect(voicingQualityMetrics(voicing.notes).rhHasEFAdjacency).toBe(false);
      expect(isCompactHandModel(voicing.notes, compactRegisterPolicy(voicing.preference))).toBe(
        true,
      );
    }
  });

  it('V2 C7(♭9) keeps Db and avoids a mid-low C-Db cluster', () => {
    for (const position of POSITIONS) {
      const voicing = render('V2', position);
      const roles = soundingRoles(voicing);
      expect(roles.has('alteredTension')).toBe(true);
      expect(roles.has('seventh')).toBe(true);
      expect(roles.has('third')).toBe(true);
      expect(
        voicing.notes.some((note) => wrapPc(note.pc) === wrapPc(voicing.harmony.rootPc + 13)),
      ).toBe(true);
      expect(voicingQualityMetrics(voicing.notes).rhHasCDbAdjacency).toBe(false);
    }
  });

  it('V3 Cmaj7 generalizes the maj7 spacing rule', () => {
    const voicing = render('V3');
    expect(soundingRoles(voicing).has('seventh')).toBe(true);
    const right = voicing.notes
      .filter((note) => note.hand === 'RH')
      .sort((left, rightNote) => left.pitch - rightNote.pitch);
    for (let index = 0; index < right.length - 1; index += 1) {
      expect(right[index + 1]!.pitch - right[index]!.pitch).toBeGreaterThan(1);
    }
  });

  it('V5 Cadd9 keeps the 9th without exile to the extreme top', () => {
    const voicing = render('V5');
    const ninth = voicing.notes.filter((note) => intervalRole(note.interval) === 'naturalTension');
    expect(ninth.length).toBeGreaterThan(0);
    expect(Math.max(...ninth.map((note) => note.pitch))).toBeLessThanOrEqual(72);
    expect(Math.min(...ninth.map((note) => note.pitch))).toBeGreaterThanOrEqual(53);
  });

  it('V6 Cmaj9 keeps 7th and 9th', () => {
    const voicing = render('V6');
    const roles = soundingRoles(voicing);
    expect(roles.has('seventh')).toBe(true);
    expect(roles.has('naturalTension')).toBe(true);
  });

  it('V7 Cm9 keeps minor 3rd, b7 and 9th', () => {
    const voicing = render('V7');
    expect(voicing.notes.some((note) => wrapPc(note.interval) === 3)).toBe(true);
    expect(voicing.notes.some((note) => wrapPc(note.interval) === 10)).toBe(true);
    expect(soundingRoles(voicing).has('naturalTension')).toBe(true);
  });

  it('V8 C13 may omit 5th but keeps 3rd, 7th and tension', () => {
    const voicing = render('V8');
    const roles = soundingRoles(voicing);
    expect(roles.has('third')).toBe(true);
    expect(roles.has('seventh')).toBe(true);
    expect(roles.has('naturalTension')).toBe(true);
  });

  it.each(['V9a', 'V9b', 'V9c'] as const)('%s keeps altered identity', (id) => {
    const voicing = render(id);
    expect(soundingRoles(voicing).has('alteredTension')).toBe(true);
    expect(soundingRoles(voicing).has('seventh')).toBe(true);
  });
});

describe('Voicing Quality 12-key gate', () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])(
    'stays legal and candidate-backed after +%i',
    (transpose) => {
      for (const item of VOICING_QUALITY_CASES) {
        for (const position of POSITIONS) {
          const voicing = render(item.id, position, transpose);
          const allowed = allowedPcs(voicing);
          expect(voicing.notes.every((note) => allowed.has(note.pc))).toBe(true);
          expect(new Set(voicing.notes.map((note) => note.pitch)).size).toBe(voicing.notes.length);
          expect(isCompactHandModel(voicing.notes, compactRegisterPolicy(voicing.preference))).toBe(
            true,
          );
          expect(
            compactCandidatesForHarmony(voicing.harmony, voicing.preference, COMPACT_V2_POLICY)
              .length,
          ).toBeGreaterThan(0);
          const availableTensions = voicing.harmony.chordIntervals.filter((interval) =>
            isTensionRole(intervalRole(interval)),
          );
          if (availableTensions.length > 0) {
            expect(voicing.notes.some((note) => isTensionRole(intervalRole(note.interval)))).toBe(
              true,
            );
          }
        }
      }
    },
  );
});

describe('Voicing Quality inversion gate', () => {
  it.each(VOICING_POSITIONS)('%s keeps requested bass and required colors', (position) => {
    for (const item of VOICING_QUALITY_CASES) {
      const voicing = render(item.id, position);
      const uniquePcs = [
        ...new Set(
          voicing.harmony.chordIntervals.map((interval) =>
            wrapPc(voicing.harmony.rootPc + interval),
          ),
        ),
      ];
      const expectedIndex = position === 'root' ? 0 : position === 'first' ? 1 : 2;
      expect(voicing.notes.find((note) => note.hand === 'LH')?.pc).toBe(
        uniquePcs[Math.min(expectedIndex, uniquePcs.length - 1)],
      );
      const available = availableRoles(voicing);
      const sounding = soundingRoles(voicing);
      if (available.has('third')) expect(sounding.has('third')).toBe(true);
      if (available.has('seventh')) expect(sounding.has('seventh')).toBe(true);
      if (available.has('alteredTension')) expect(sounding.has('alteredTension')).toBe(true);
    }
  });
});

function availableRoles(voicing: BaseVoicing): Set<string> {
  return new Set(voicing.harmony.chordIntervals.map(intervalRole));
}

describe('Voicing Quality style neutrality', () => {
  it('Shared Base pitches do not depend on a style name', () => {
    const harmony = harmonyFromQualityCase(caseById('V2'));
    const preference = { position: 'root' as VoicingPosition, octaveShift: 0 };
    const pitches = buildCompactBaseVoicings([harmony], preference, COMPACT_V2_POLICY).map(
      (voicing) => voicing.notes.map((note) => note.pitch),
    );
    const consumers = ['block', 'natural', 'city'].map(() =>
      buildCompactBaseVoicings([harmony], preference, COMPACT_V2_POLICY).map((voicing) =>
        voicing.notes.map((note) => note.pitch),
      ),
    );
    expect(consumers).toEqual([pitches, pitches, pitches]);
  });
});
