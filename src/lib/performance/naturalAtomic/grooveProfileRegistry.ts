import {
  CANDIDATE_GROOVE_PROFILES,
  type CandidateGrooveAttackSpec,
  type CandidateNaturalVariantId,
  type CandidatePedalSpec,
} from './candidateGrooveProfiles';
import { DANCE_GROOVE_PROFILE, DANCE_VARIANT_ID } from './danceGrooveProfile';

export type ProfileGrooveVariantId = CandidateNaturalVariantId | typeof DANCE_VARIANT_ID;

export type RegisteredGrooveProfile = {
  id: ProfileGrooveVariantId;
  sourceCandidateId: string;
  bars: readonly (readonly CandidateGrooveAttackSpec[])[];
  pedalByBar: readonly (readonly CandidatePedalSpec[])[];
};

export const GROOVE_PROFILE_REGISTRY: Readonly<
  Record<ProfileGrooveVariantId, RegisteredGrooveProfile>
> = {
  ...CANDIDATE_GROOVE_PROFILES,
  [DANCE_VARIANT_ID]: DANCE_GROOVE_PROFILE,
};

export function grooveProfileForVariant(variantId: unknown): RegisteredGrooveProfile | undefined {
  if (typeof variantId !== 'string' || !(variantId in GROOVE_PROFILE_REGISTRY)) return undefined;
  return GROOVE_PROFILE_REGISTRY[variantId as ProfileGrooveVariantId];
}
