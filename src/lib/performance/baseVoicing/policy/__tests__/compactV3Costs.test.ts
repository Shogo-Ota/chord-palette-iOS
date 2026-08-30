/**
 * `compact.v3` rejection model.
 *
 * The point of these cases is that the policy and the output validator agree by
 * construction: both call `evaluateIntervalPair`, so a voicing the policy accepts is
 * one the validator passes. What is worth testing here is the wiring — that a
 * rejection is priced high enough to outrank every soft cost and every continuity
 * cost, and finite enough that an unvoiceable chord still produces something.
 */
import { chordHarmonyFromEvent } from '../../../humanTemplate/chordHarmony';
import { buildCompactBaseVoicings } from '../../CompactVoicingEngine';
import type { BaseVoicingNote, BaseVoicingPreference } from '../../types';
import { COMPACT_V2_POLICY } from '../compactV2Policy';
import {
  COLLISION_REJECT_COST,
  collisionRejections,
  evaluateCompactV3Cost,
} from '../compactV3Costs';
import { COMPACT_V3_POLICY } from '../compactV3Policy';
import { collisionChordFromIntervals } from '../../../harmonyCollision';
import type { VoicingCostContext } from '../types';

const PREFERENCE: BaseVoicingPreference = { position: 'root', octaveShift: 0 };

const CMAJ7_CONTEXT: VoicingCostContext = { rootPc: 0, availableIntervals: [0, 4, 7, 11] };
const C7B9_CONTEXT: VoicingCostContext = { rootPc: 0, availableIntervals: [0, 4, 7, 10, 13] };

function notes(pitches: readonly number[], intervals: readonly number[]): BaseVoicingNote[] {
  return pitches.map((pitch, index) => ({
    pitch,
    pc: ((pitch % 12) + 12) % 12,
    interval: intervals[index] ?? 0,
    degree: 'root',
    hand: index === 0 ? 'LH' : 'RH',
    isBass: index === 0,
    isDuplicate: false,
  })) as BaseVoicingNote[];
}

describe('collision rejections on a candidate', () => {
  it('rejects the semitone in the approved Cmaj7 voicing', () => {
    // C3 G3 B3 C4 E4 — the shipped voicing behind the muddy Cmaj7 report.
    const rejections = collisionRejections(
      notes([48, 55, 59, 60, 64], [0, 7, 11, 0, 4]),
      PREFERENCE,
      collisionChordFromIntervals(0, [0, 4, 7, 11]),
    );
    expect(rejections).toHaveLength(1);
    expect(rejections[0]).toMatchObject({ lowerNote: 59, upperNote: 60, ruleId: 'MINOR_SECOND' });
  });

  it('accepts the same chord once the doubled root is gone', () => {
    // C3 G3 B3 E4 — what removing the duplicate leaves.
    expect(
      collisionRejections(
        notes([48, 55, 59, 64], [0, 7, 11, 4]),
        PREFERENCE,
        collisionChordFromIntervals(0, [0, 4, 7, 11]),
      ),
    ).toEqual([]);
  });

  it('compares every pair, not only neighbours', () => {
    // C3 and Db4 are not adjacent in C3 Db4 E4 G4, and still collide.
    const rejections = collisionRejections(
      notes([48, 61, 64, 67], [0, 13, 4, 7]),
      PREFERENCE,
      collisionChordFromIntervals(0, [0, 4, 7]),
    );
    expect(rejections.map((rejection) => rejection.ruleId)).toContain('MINOR_NINTH');
  });

  it('admits the minor ninth a ♭9 chord declares', () => {
    expect(
      collisionRejections(
        notes([48, 58, 61, 64], [0, 10, 13, 4]),
        PREFERENCE,
        collisionChordFromIntervals(0, [0, 4, 7, 10, 13]),
      ),
    ).toEqual([]);
  });
});

describe('rejection pricing', () => {
  it('outranks every soft cost a clean voicing could accumulate', () => {
    const dirty = evaluateCompactV3Cost(
      notes([48, 55, 59, 60, 64], [0, 7, 11, 0, 4]),
      PREFERENCE,
      CMAJ7_CONTEXT,
    );
    const clean = evaluateCompactV3Cost(
      notes([48, 55, 59, 64], [0, 7, 11, 4]),
      PREFERENCE,
      CMAJ7_CONTEXT,
    );
    expect(dirty.hardReject).toBe(true);
    expect(clean.hardReject).toBe(false);
    expect(clean.collisionCost).toBe(0);
    expect(dirty.collisionCost).toBe(COLLISION_REJECT_COST);
    expect(dirty.totalSoftCost - clean.totalSoftCost).toBeGreaterThan(1_000);
  });

  it('stays finite so an unvoiceable chord still yields a voicing', () => {
    const dirty = evaluateCompactV3Cost(
      notes([48, 55, 59, 60, 64], [0, 7, 11, 0, 4]),
      PREFERENCE,
      CMAJ7_CONTEXT,
    );
    expect(Number.isFinite(dirty.totalSoftCost)).toBe(true);
    expect(
      COMPACT_V3_POLICY.staticCost(
        notes([48, 55, 59, 60, 64], [0, 7, 11, 0, 4]),
        PREFERENCE,
        CMAJ7_CONTEXT,
      ),
    ).toBeLessThan(Number.POSITIVE_INFINITY);
  });

  it('keeps v2 soft scoring intact underneath', () => {
    const clean = notes([48, 55, 59, 64], [0, 7, 11, 4]);
    const v3 = evaluateCompactV3Cost(clean, PREFERENCE, CMAJ7_CONTEXT);
    expect(v3.collisionCost).toBe(0);
    expect(COMPACT_V3_POLICY.staticCost(clean, PREFERENCE, CMAJ7_CONTEXT)).toBe(
      COMPACT_V2_POLICY.staticCost(clean, PREFERENCE, CMAJ7_CONTEXT),
    );
  });

  it('prices a ♭9 chord the same as v2 when nothing collides', () => {
    const clean = notes([48, 58, 61, 64], [0, 10, 13, 4]);
    expect(COMPACT_V3_POLICY.staticCost(clean, PREFERENCE, C7B9_CONTEXT)).toBe(
      COMPACT_V2_POLICY.staticCost(clean, PREFERENCE, C7B9_CONTEXT),
    );
  });
});

describe('the gate changes what the engine selects', () => {
  it('drops the doubled root from Cmaj7', () => {
    const harmony = chordHarmonyFromEvent(
      { rootOffset: 0, suffix: 'maj7', definitionId: 'maj7' },
      'C',
    );
    const pitchesFor = (policy: typeof COMPACT_V3_POLICY) =>
      buildCompactBaseVoicings([harmony], PREFERENCE, policy)[0]!.notes.map((note) => note.pitch);
    const v3 = pitchesFor(COMPACT_V3_POLICY);
    for (let index = 0; index < v3.length - 1; index += 1) {
      expect(v3[index + 1]! - v3[index]!).not.toBe(1);
    }
    expect(new Set(v3.map((pitch) => ((pitch % 12) + 12) % 12)).size).toBe(v3.length);
  });
});
