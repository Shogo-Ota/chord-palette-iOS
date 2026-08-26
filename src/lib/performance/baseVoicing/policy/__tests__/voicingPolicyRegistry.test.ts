/**
 * Governance gate: the Shared Base that ships is the one a human approved.
 *
 * A candidate policy may exist, be tested and be auditioned, but it must not
 * become the default until its own listening pass replaces the approval.
 */
import { chordHarmonyFromEvent } from '../../../humanTemplate/chordHarmony';
import { buildCompactBaseVoicings } from '../../CompactVoicingEngine';
import {
  APPROVED_VOICING_POLICY_ID,
  VOICING_POLICY_IDS,
  activeVoicingPolicy,
  activeVoicingPolicyId,
  normalizeVoicingPolicyId,
  setVoicingPolicyOverride,
  voicingPolicyById,
  voicingPolicyOptions,
} from '../registry';

const HARMONY = chordHarmonyFromEvent({ rootOffset: 0, suffix: 'maj9', definitionId: 'maj9' }, 'C');

describe('voicing policy registry', () => {
  afterEach(() => {
    setVoicingPolicyOverride(null);
  });

  it('defaults to the listening-approved policy', () => {
    expect(activeVoicingPolicyId()).toBe(APPROVED_VOICING_POLICY_ID);
    expect(activeVoicingPolicy().id).toBe('compact.v1');
    expect(activeVoicingPolicy().listeningApproved).toBe(true);
  });

  it('never allows an unapproved policy to be the default', () => {
    expect(voicingPolicyById(APPROVED_VOICING_POLICY_ID).listeningApproved).toBe(true);
    expect(voicingPolicyById('compact.v2').listeningApproved).toBe(false);
  });

  it('resolves every registered id and rejects anything else', () => {
    for (const id of VOICING_POLICY_IDS) {
      expect(voicingPolicyById(id).id).toBe(id);
      expect(normalizeVoicingPolicyId(id)).toBe(id);
    }
    expect(normalizeVoicingPolicyId('compact.v9')).toBe(APPROVED_VOICING_POLICY_ID);
    expect(normalizeVoicingPolicyId(undefined)).toBe(APPROVED_VOICING_POLICY_ID);
  });

  it('exposes both policies for the dev audition, approval state included', () => {
    expect(voicingPolicyOptions()).toEqual([
      { id: 'compact.v1', label: expect.any(String), listeningApproved: true },
      { id: 'compact.v2', label: expect.any(String), listeningApproved: false },
    ]);
  });

  it('applies a reversible override to the pitches the engine resolves', () => {
    const preference = { position: 'root' as const, octaveShift: 0 };
    const pitches = (policy?: ReturnType<typeof voicingPolicyById>) =>
      buildCompactBaseVoicings([HARMONY], preference, policy).map((voicing) =>
        voicing.notes.map((note) => note.pitch),
      );

    expect(pitches()).toEqual(pitches(voicingPolicyById('compact.v1')));

    setVoicingPolicyOverride('compact.v2');
    expect(activeVoicingPolicyId()).toBe('compact.v2');
    expect(pitches()).toEqual(pitches(voicingPolicyById('compact.v2')));

    setVoicingPolicyOverride(null);
    expect(activeVoicingPolicyId()).toBe(APPROVED_VOICING_POLICY_ID);
    expect(pitches()).toEqual(pitches(voicingPolicyById('compact.v1')));
  });
});
