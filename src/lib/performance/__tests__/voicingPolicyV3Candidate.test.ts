/**
 * `compact.v3` candidate checkpoint — a change detector, NOT an approval.
 *
 * Same role as the v2 checkpoint: pin what the candidate currently produces so
 * retuning shows up as a reviewable diff and the listening pass is run against a
 * known artifact. Pitches are stored as MIDI numbers so a musician can read them.
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

describe('compact.v3 candidate voicing checkpoint', () => {
  it('keeps the candidate Shared Base pitches stable', () => {
    const actual = sharedBasePitches(COMPACT_V3_POLICY);
    if (process.env.WRITE_VOICING_V3_BASELINE === '1') {
      writeFileSync(
        FIXTURE_PATH,
        `${JSON.stringify({ ...expected, capturedAt: new Date().toISOString(), voicings: actual }, null, 2)}\n`,
      );
    }
    expect(actual).toEqual(expected.voicings);
  });

  it('is recorded as a candidate, never as an approval', () => {
    expect(expected.policy).toBe('compact.v3');
    expect(expected.listeningApproved).toBe(false);
    expect(COMPACT_V3_POLICY.listeningApproved).toBe(false);
    expect(activeVoicingPolicy().id).toBe(COMPACT_V1_POLICY.id);
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

  it('differs from both shipped policies, so the audition has something to judge', () => {
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
