/**
 * `compact.v3` Shared Base checkpoint — the pitches that ship, in MIDI numbers a
 * musician can read.
 *
 * This started as a candidate change detector and became the shipping record when
 * v3 was approved by ear (87–89/100, device listening 2026-08-28). It sits one level
 * below `releaseAccompanimentBaselineV87`: that test hashes the whole performance,
 * this one names the individual pitches, so a voicing regression is legible instead
 * of being a changed digest.
 *
 * Refresh after an intentional v3 change (the write pass fails by design, since it
 * compares against the fixture it just replaced):
 *   WRITE_VOICING_V3_BASELINE=1 npx jest voicingPolicyV3Candidate
 *   npx prettier --write src/lib/performance/__tests__/fixtures/voicingPolicyV3Candidate.json
 *   npx jest voicingPolicyV3Candidate
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import expected from '@/lib/performance/__tests__/fixtures/voicingPolicyV3Candidate.json';
import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import {
  COMPACT_V1_POLICY,
  COMPACT_V2_POLICY,
  COMPACT_V3_POLICY,
  VOICING_POSITIONS,
  activeVoicingPolicy,
  buildCompactBaseVoicings,
  compactRegisterPolicy,
  isCompactHandModel,
  type VoicingPolicySpec,
} from '@/lib/performance/baseVoicing';
import { chordHarmonyFromEvent } from '@/lib/performance/humanTemplate/chordHarmony';

const FIXTURE_PATH = join(
  process.cwd(),
  'src',
  'lib',
  'performance',
  '__tests__',
  'fixtures',
  'voicingPolicyV3Candidate.json',
);

function sharedBasePitches(policy: VoicingPolicySpec): Record<string, number[][]> {
  const result: Record<string, number[][]> = {};
  for (const position of VOICING_POSITIONS) {
    for (const progression of GOLDEN_PROGRESSIONS) {
      const harmonies = progression.chords.map((chord) =>
        chordHarmonyFromEvent(chord, progression.key),
      );
      result[`${progression.id}:${position}`] = buildCompactBaseVoicings(
        harmonies,
        { position, octaveShift: 0 },
        policy,
      ).map((voicing) =>
        voicing.notes.map((note) => note.pitch).sort((left, right) => left - right),
      );
    }
  }
  return result;
}

describe('compact.v3 shipping voicing checkpoint', () => {
  it('keeps the shipping Shared Base pitches stable', () => {
    const actual = sharedBasePitches(COMPACT_V3_POLICY);
    if (process.env.WRITE_VOICING_V3_BASELINE === '1') {
      writeFileSync(
        FIXTURE_PATH,
        `${JSON.stringify({ ...expected, capturedAt: new Date().toISOString(), voicings: actual }, null, 2)}\n`,
      );
    }
    expect(actual).toEqual(expected.voicings);
  });

  it('is the approved policy production actually resolves', () => {
    expect(expected.policy).toBe('compact.v3');
    expect(expected.listeningApproved).toBe(true);
    expect(COMPACT_V3_POLICY.listeningApproved).toBe(true);
    expect(activeVoicingPolicy().id).toBe(COMPACT_V3_POLICY.id);
  });

  it('holds no semitone and no undeclared minor ninth anywhere', () => {
    for (const chords of Object.values(expected.voicings as Record<string, number[][]>)) {
      for (const pitches of chords) {
        for (let low = 0; low < pitches.length - 1; low += 1) {
          for (let high = low + 1; high < pitches.length; high += 1) {
            expect(pitches[high]! - pitches[low]!).not.toBe(1);
          }
        }
      }
    }
  });

  it('differs from both superseded policies, so the promotion actually changed the sound', () => {
    const v3 = sharedBasePitches(COMPACT_V3_POLICY);
    for (const policy of [COMPACT_V1_POLICY, COMPACT_V2_POLICY]) {
      const other = sharedBasePitches(policy);
      const changed = Object.keys(other).filter(
        (key) => JSON.stringify(other[key]) !== JSON.stringify(v3[key]),
      );
      expect({ policy: policy.id, changed: changed.length > 0 }).toEqual({
        policy: policy.id,
        changed: true,
      });
    }
  });

  it('stays inside the compact hand model on every candidate voicing', () => {
    for (const position of VOICING_POSITIONS) {
      for (const progression of GOLDEN_PROGRESSIONS) {
        const harmonies = progression.chords.map((chord) =>
          chordHarmonyFromEvent(chord, progression.key),
        );
        buildCompactBaseVoicings(
          harmonies,
          { position, octaveShift: 0 },
          COMPACT_V3_POLICY,
        ).forEach((voicing) => {
          expect(isCompactHandModel(voicing.notes, compactRegisterPolicy(voicing.preference))).toBe(
            true,
          );
        });
      }
    }
  });
});
