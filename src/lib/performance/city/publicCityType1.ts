import type { PerfChord } from '../PerformanceEngine';
import { realizeCityType1 } from './realizeCityType1';
import type { CityType1CandidateId, CityType1Plan } from './types';

/**
 * Listening-approved Production policy. Candidate A remains an offline density
 * control and Candidate C remains an offline roll comparison; neither is reachable
 * through the public City Type1 path.
 */
export const PUBLIC_CITY_TYPE1_CANDIDATE: CityType1CandidateId = 'B_SUBTRACTIVE';

export function realizePublicCityType1(
  chords: readonly PerfChord[],
  seed: number,
): CityType1Plan {
  return realizeCityType1(chords, PUBLIC_CITY_TYPE1_CANDIDATE, seed);
}
