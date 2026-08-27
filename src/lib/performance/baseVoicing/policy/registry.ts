/**
 * Voicing policy provider.
 *
 * Every caller — product playback, MIDI export, video render — resolves the
 * Shared Base policy here, so an unapproved voicing cannot ship by accident:
 * the default is always the listening-approved policy. A candidate is reachable
 * only through an explicit, reversible override, which the dev listening screen
 * uses to compare policies by ear inside one build.
 */

import { COMPACT_V1_POLICY } from './compactV1Policy';
import { COMPACT_V2_POLICY } from './compactV2Policy';
import { COMPACT_V3_POLICY } from './compactV3Policy';
import type { VoicingPolicyId, VoicingPolicySpec } from './types';

export const VOICING_POLICY_IDS = ['compact.v1', 'compact.v2', 'compact.v3'] as const;

/** The only policy allowed to be the default. */
export const APPROVED_VOICING_POLICY_ID: VoicingPolicyId = 'compact.v1';

const POLICIES: Record<VoicingPolicyId, VoicingPolicySpec> = {
  'compact.v1': COMPACT_V1_POLICY,
  'compact.v2': COMPACT_V2_POLICY,
  'compact.v3': COMPACT_V3_POLICY,
};

let override: VoicingPolicyId | null = null;

export function voicingPolicyById(id: VoicingPolicyId): VoicingPolicySpec {
  return POLICIES[id];
}

export function normalizeVoicingPolicyId(value: unknown): VoicingPolicyId {
  return VOICING_POLICY_IDS.includes(value as VoicingPolicyId)
    ? (value as VoicingPolicyId)
    : APPROVED_VOICING_POLICY_ID;
}

export function activeVoicingPolicyId(): VoicingPolicyId {
  return override ?? APPROVED_VOICING_POLICY_ID;
}

export function activeVoicingPolicy(): VoicingPolicySpec {
  return POLICIES[activeVoicingPolicyId()];
}

/** Diagnostic only. `null` restores the approved default. */
export function setVoicingPolicyOverride(id: VoicingPolicyId | null): void {
  override = id;
}

export function voicingPolicyOptions(): {
  id: VoicingPolicyId;
  label: string;
  listeningApproved: boolean;
}[] {
  return VOICING_POLICY_IDS.map((id) => ({
    id,
    label: POLICIES[id].label,
    listeningApproved: POLICIES[id].listeningApproved,
  }));
}
