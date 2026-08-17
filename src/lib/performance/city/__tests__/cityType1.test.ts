import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import {
  CITY_TYPE1_GROOVE,
  PUBLIC_CITY_TYPE1_CANDIDATE,
  realizeCityType1,
  realizePublicCityType1,
  validateCityType1,
  type CityType1CandidateId,
} from '@/lib/performance/city';
import { applyVoicingMask } from '@/lib/performance/chordComping';
import { PHASE3C_CASES } from '@/lib/playback/phase3cCases';

function cityFor(candidateId: CityType1CandidateId) {
  const current = buildSessionPerformancePlan(PHASE3C_CASES['natural-type1'].session, 'free');
  return {
    current,
    city: realizeCityType1(current.chords, candidateId, current.seed),
  };
}

describe('City Type1 offline generator', () => {
  it('uses the measured six-attack beat-domain cycle with explicit gaps', () => {
    const { current, city } = cityFor('A_FULL');

    expect(city.attacks).toHaveLength(current.chords.length * 6);
    for (const chord of current.chords) {
      const attacks = city.attacks.filter(
        (attack) => attack.chordIndex === current.chords.indexOf(chord),
      );
      expect(attacks.map((attack) => attack.cycleAttackIndex)).toEqual([0, 1, 2, 3, 4, 5]);
      expect(attacks.map((attack) => attack.onsetBeat - chord.startBeat)).toEqual([
        0, 0.5, 0.75, 1.25, 1.75, 2,
      ]);
      expect(attacks.every((attack) => attack.gapToNextAttackBeat >= 0)).toBe(true);
      expect(attacks[5]!.gapToNextAttackBeat).toBeGreaterThan(1.7);
    }
    expect(CITY_TYPE1_GROOVE.sourceContract.sourceGridDelayBeat).toBe(0.008333);
    expect(CITY_TYPE1_GROOVE.sourceContract.literalPitchExcluded).toBe(true);
    expect(CITY_TYPE1_GROOVE.sourceContract.harmonyExcluded).toBe(true);
  });

  it('keeps Candidate A as simultaneous FULL attack groups', () => {
    const { city } = cityFor('A_FULL');

    expect(city.attacks.every((attack) => attack.mask === 'FULL')).toBe(true);
    expect(city.attacks.every((attack) => attack.rollSpreadBeat === 0)).toBe(true);
    for (const attack of city.attacks) {
      const voicing = city.fullVoicings[attack.chordIndex]!;
      const notes = city.notes.filter((note) => Math.abs(note.timeBeat - attack.onsetBeat) <= 1e-9);
      expect(notes.map((note) => note.pitch)).toEqual(voicing.notes.map((note) => note.pitch));
    }
  });

  it('keeps Candidate B subtractive without revoicing', () => {
    const { city } = cityFor('B_SUBTRACTIVE');

    for (const attack of city.attacks) {
      const voicing = city.fullVoicings[attack.chordIndex]!;
      const fullPitches = new Set(voicing.notes.map((note) => note.pitch));
      const selected = applyVoicingMask(voicing, attack.mask);
      const notes = city.notes.filter((note) => Math.abs(note.timeBeat - attack.onsetBeat) <= 1e-9);
      expect(notes.map((note) => note.pitch)).toEqual(selected.map((note) => note.pitch));
      expect(notes.every((note) => fullPitches.has(note.pitch))).toBe(true);
    }
    expect(city.attacks.some((attack) => attack.mask === 'ROOT_ONLY')).toBe(true);
    expect(city.attacks.some((attack) => attack.mask === 'SHELL')).toBe(true);
  });

  it('keeps Candidate C inside one atomic group with deterministic ascending roll', () => {
    const { current, city } = cityFor('C_SUBTRACTIVE_ROLL');
    const repeated = realizeCityType1(current.chords, 'C_SUBTRACTIVE_ROLL', current.seed + 999);

    expect(city.notes.map((note) => note.timeBeat)).toEqual(
      repeated.notes.map((note) => note.timeBeat),
    );
    for (const attack of city.attacks) {
      const notes = city.notes
        .filter(
          (note) =>
            note.timeBeat >= attack.onsetBeat - 1e-9 &&
            note.timeBeat <= attack.onsetBeat + attack.rollSpreadBeat + 1e-9,
        )
        .sort((left, right) => left.pitch - right.pitch);
      expect(notes.length).toBeGreaterThan(0);
      expect(attack.rollSpreadBeat).toBeLessThanOrEqual(1 / 32);
      for (let index = 1; index < notes.length; index += 1) {
        expect(notes[index]!.timeBeat).toBeGreaterThanOrEqual(notes[index - 1]!.timeBeat);
      }
    }
  });

  it.each(['A_FULL', 'B_SUBTRACTIVE', 'C_SUBTRACTIVE_ROLL'] as const)(
    'passes every City hard gate for %s',
    (candidateId) => {
      const { city } = cityFor(candidateId);
      const report = validateCityType1(city);

      expect(report.failures).toEqual([]);
      expect(report.pass).toBe(true);
      expect(report.userChordLegalityPct).toBe(100);
      expect(report.duplicateSimultaneousMidi).toBe(0);
      expect(report.invalidVoiceCrossing).toBe(0);
      expect(report.slashBassPass).toBe(true);
      expect(report.sourceHarmonyLeakage).toBe(0);
      expect(report.pitchClampApplied).toBe(false);
      expect(report.cityQa.atomicAttackGroupPass).toBe(true);
    },
  );
});

describe('Public City Type1 integration', () => {
  it('locks the listening winner to Candidate B with no hand roll', () => {
    const source = PHASE3C_CASES['natural-type1'].session;
    const plan = buildSessionPerformancePlan(
      {
        ...source,
        accompanimentPattern: 'city',
        accompanimentVariant: 'city.type1',
        instrumentEffect: 'off',
      },
      'free',
    );
    const publicCity = realizePublicCityType1(plan.chords, plan.seed);

    expect(PUBLIC_CITY_TYPE1_CANDIDATE).toBe('B_SUBTRACTIVE');
    expect(publicCity.candidateId).toBe('B_SUBTRACTIVE');
    expect(publicCity.attacks.some((attack) => attack.mask !== 'FULL')).toBe(true);
    expect(publicCity.attacks.every((attack) => attack.rollSpreadBeat === 0)).toBe(true);
    expect(plan.notes).toEqual(publicCity.notes);
    expect(plan.humanTemplateId).toBeUndefined();
    expect(plan.harmonyViolations).toEqual([]);
  });
});
