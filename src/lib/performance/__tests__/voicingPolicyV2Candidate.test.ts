/**
 * `compact.v2` candidate checkpoint — a change detector, NOT an approval.
 *
 * The approved Shared Base is `compact.v1` (`releaseAccompanimentBaselineV87`).
 * This file pins what the candidate currently produces so any further retuning
 * shows up as a reviewable diff instead of a silent drift, and so the eventual
 * listening pass is run against a known artifact. Pitches are stored as MIDI
 * numbers rather than a hash because a musician has to be able to read them.
 *
 * Refresh after an intentional v2 change (the write pass fails by design, since it
 * compares against the fixture it just replaced):
 *   WRITE_VOICING_CANDIDATE_BASELINE=1 npx jest voicingPolicyV2Candidate
 *   npx prettier --write src/lib/performance/__tests__/fixtures/voicingPolicyV2Candidate.json
 *   npx jest voicingPolicyV2Candidate
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import expected from '@/lib/performance/__tests__/fixtures/voicingPolicyV2Candidate.json';
import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import {
  COMPACT_V1_POLICY,
  COMPACT_V2_POLICY,
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
  'voicingPolicyV2Candidate.json',
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

describe('compact.v2 candidate voicing checkpoint', () => {
  it('keeps the candidate Shared Base pitches stable', () => {
    const actual = sharedBasePitches(COMPACT_V2_POLICY);
    if (process.env.WRITE_VOICING_CANDIDATE_BASELINE === '1') {
      writeFileSync(
        FIXTURE_PATH,
        `${JSON.stringify({ ...expected, capturedAt: new Date().toISOString(), voicings: actual }, null, 2)}\n`,
      );
    }
    expect(actual).toEqual(expected.voicings);
  });

  it('is recorded as a candidate, never as an approval', () => {
    expect(expected.policy).toBe('compact.v2');
    expect(expected.listeningApproved).toBe(false);
    expect(COMPACT_V2_POLICY.listeningApproved).toBe(false);
  });

  it('leaves the approved policy as the one production resolves', () => {
    expect(activeVoicingPolicy().id).toBe(COMPACT_V1_POLICY.id);
    expect(activeVoicingPolicy().listeningApproved).toBe(true);
  });

  it('actually differs from the approved policy, so the audition has something to judge', () => {
    const approved = sharedBasePitches(COMPACT_V1_POLICY);
    const candidate = sharedBasePitches(COMPACT_V2_POLICY);
    const changed = Object.keys(approved).filter(
      (key) => JSON.stringify(approved[key]) !== JSON.stringify(candidate[key]),
    );
    expect(changed.length).toBeGreaterThan(0);
  });

  it('stays inside the compact hand model on every candidate voicing', () => {
    const registers = compactRegisterPolicy({ position: 'root', octaveShift: 0 });
    for (const [key, chords] of Object.entries(expected.voicings as Record<string, number[][]>)) {
      for (const pitches of chords) {
        expect(pitches.length).toBeGreaterThanOrEqual(3);
        expect(pitches.length).toBeLessThanOrEqual(5);
        expect(pitches[0]).toBeGreaterThanOrEqual(registers.lh.lo);
        expect(pitches[pitches.length - 1]).toBeLessThanOrEqual(registers.rh.hi);
        expect(new Set(pitches).size).toBe(pitches.length);
        expect(key).toMatch(/^[A-I]:(root|first|second)$/);
      }
    }
  });

  it('reproduces the candidate voicings through the compact hand model contract', () => {
    for (const position of VOICING_POSITIONS) {
      for (const progression of GOLDEN_PROGRESSIONS) {
        const harmonies = progression.chords.map((chord) =>
          chordHarmonyFromEvent(chord, progression.key),
        );
        const voicings = buildCompactBaseVoicings(
          harmonies,
          { position, octaveShift: 0 },
          COMPACT_V2_POLICY,
        );
        voicings.forEach((voicing) => {
          expect(isCompactHandModel(voicing.notes, compactRegisterPolicy(voicing.preference))).toBe(
            true,
          );
        });
      }
    }
  });
});
