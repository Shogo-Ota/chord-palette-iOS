import {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
  type SessionPerformancePlan,
} from '@/lib/midiExport';
import {
  realizeCityType1,
  type CityType1CandidateId,
  type CityType1Plan,
} from '@/lib/performance/city';
import { PHASE3C_CASES } from '@/lib/playback/phase3cCases';
import type { ChordEvent, MajorKey } from '@/types';

export type CityPocProgression = {
  id: 'A' | 'B' | 'C' | 'D';
  label: string;
  key: MajorKey;
  progression: ChordEvent[];
};

export const CITY_POC_CANDIDATES: readonly {
  id: CityType1CandidateId;
  fileToken: string;
  label: string;
}[] = [
  { id: 'A_FULL', fileToken: 'A-full', label: 'A · FULL simultaneous' },
  {
    id: 'B_SUBTRACTIVE',
    fileToken: 'B-subtractive',
    label: 'B · conservative subtraction simultaneous',
  },
  {
    id: 'C_SUBTRACTIVE_ROLL',
    fileToken: 'C-subtractive-roll',
    label: 'C · conservative subtraction + measured roll',
  },
];

function chord(
  id: string,
  rootOffset: number,
  suffix: string,
  displayName: string,
  bassOffset?: number,
): ChordEvent {
  return {
    id: `city-poc-${id}`,
    chordId: `city-poc-${id}`,
    rootOffset,
    suffix,
    displayName,
    degreeLabel: '',
    function: 'tonic',
    isPro: false,
    durationBeats: 4,
    ...(bassOffset == null ? {} : { bassOffset }),
  };
}

export function cityPocProgressions(): CityPocProgression[] {
  return [
    {
      id: 'A',
      label: 'C | Am | F | G',
      key: 'C',
      progression: [
        chord('a-c', 0, '', 'C'),
        chord('a-am', 9, 'm', 'Am'),
        chord('a-f', 5, '', 'F'),
        chord('a-g', 7, '', 'G'),
      ],
    },
    {
      id: 'B',
      label: 'Cmaj7 | Am7 | Fmaj7 | G7',
      key: 'C',
      progression: [
        chord('b-cmaj7', 0, 'maj7', 'Cmaj7'),
        chord('b-am7', 9, 'm7', 'Am7'),
        chord('b-fmaj7', 5, 'maj7', 'Fmaj7'),
        chord('b-g7', 7, '7', 'G7'),
      ],
    },
    {
      id: 'C',
      label: 'C | Cadd9 | Cmaj7 | C7',
      key: 'C',
      progression: [
        chord('c-c', 0, '', 'C'),
        chord('c-cadd9', 0, 'add9', 'Cadd9'),
        chord('c-cmaj7', 0, 'maj7', 'Cmaj7'),
        chord('c-c7', 0, '7', 'C7'),
      ],
    },
    {
      id: 'D',
      label: 'C | G/B | Am | F',
      key: 'C',
      progression: [
        chord('d-c', 0, '', 'C'),
        chord('d-g-over-b', 7, '', 'G/B', 11),
        chord('d-am', 9, 'm', 'Am'),
        chord('d-f', 5, '', 'F'),
      ],
    },
  ];
}

export function cityPocSession(poc: CityPocProgression, bpm = 90): PerformanceSessionInput {
  return {
    ...PHASE3C_CASES['natural-type1'].session,
    key: poc.key,
    tempoBpm: bpm,
    instrumentId: 'piano',
    instrumentEffect: 'off',
    drumMode: 'off',
    progression: poc.progression,
  };
}

export function buildCityPocPerformance(
  poc: CityPocProgression,
  candidateId: CityType1CandidateId,
  bpm = 90,
): { plan: SessionPerformancePlan; city: CityType1Plan } {
  const current = buildSessionPerformancePlan(cityPocSession(poc, bpm), 'free');
  const city = realizeCityType1(current.chords, candidateId, current.seed);
  const { humanTemplateId: _humanTemplateId, ...withoutTeacherPedal } = current;
  return {
    city,
    plan: {
      ...withoutTeacherPedal,
      notes: city.notes,
      harmonyViolations: [],
    },
  };
}
