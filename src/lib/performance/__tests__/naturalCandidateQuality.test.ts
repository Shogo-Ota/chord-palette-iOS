import { createHash } from 'node:crypto';

import { MAJOR_KEYS } from '@/data/music';
import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import type { VoicingPosition } from '@/lib/performance/baseVoicing';
import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
} from '@/lib/performance/finalMidi/buildSessionPerformancePlan';

const CANDIDATES = ['natural.type2', 'natural.type3', 'natural.type4', 'natural.type5'] as const;
const BUILD13_NOTE_DIGESTS = {
  'natural.type2': '8e3996c3f423824e2ff9f0bf6196189360f1aafdec398719f24ed15a508f390c',
  'natural.type3': '562ef4d277c18e32d205eb3499dd86830bf3c28729a258f0c4b67b6fb6ca097f',
  'natural.type4': '9ed7f79f5ed86693500c354b081bd50a79504945b77a920e6e39fd5e32dd1363',
} as const;
const POSITIONS: readonly VoicingPosition[] = ['root', 'first', 'second'];

function render(
  progression: (typeof GOLDEN_PROGRESSIONS)[number],
  variant: (typeof CANDIDATES)[number],
  voicingPosition: VoicingPosition,
  instrumentEffect: 'sustain' | 'releaseCut' = 'sustain',
) {
  const session: PerformanceSessionInput = {
    key: progression.key,
    tempoBpm: progression.bpm,
    grooveId: 'pop8',
    accompanimentPattern: 'natural',
    accompanimentVariant: variant,
    accompanimentEnergy: 'build',
    instrumentId: 'piano',
    octaveShift: 0,
    voicingPosition,
    releaseCut: instrumentEffect === 'releaseCut',
    instrumentEffect,
    drumMode: 'off',
    progression: progression.chords,
  };
  return buildSessionPerformancePlan(session, 'free');
}

function baseSignature(plan: ReturnType<typeof render>): string {
  return plan.chords
    .map((chord) => `${chord.bassMidi.join(',')}/${chord.bodyMidi.join(',')}`)
    .join('|');
}

function candidateNoteDigest(plan: ReturnType<typeof render>): string {
  const payload = plan.notes
    .filter((note) => note.trackId === 'chord' || note.trackId === 'bass')
    .map((note) => [
      Math.round(note.timeBeat * 1_000_000) / 1_000_000,
      Math.round(note.durationBeat * 1_000_000) / 1_000_000,
      note.pitch,
      note.velocity,
      note.trackId,
    ]);
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

describe('Natural Type2–5 promotion quality', () => {
  it('keeps Shared Base Voicing exactly invariant across every candidate', () => {
    for (const progression of GOLDEN_PROGRESSIONS) {
      for (const position of POSITIONS) {
        const plans = CANDIDATES.map((variant) => render(progression, variant, position));
        expect(new Set(plans.map(baseSignature)).size).toBe(1);
      }
    }
  });

  it('emits only unchanged Shared Base pitches with no duplicate MIDI', () => {
    for (const progression of GOLDEN_PROGRESSIONS) {
      for (const variant of CANDIDATES) {
        const plan = render(progression, variant, 'root');
        expect(plan.harmonyViolations).toEqual([]);
        for (const note of plan.notes.filter(
          (candidate) => candidate.trackId === 'chord' || candidate.trackId === 'bass',
        )) {
          const chord = plan.chords.find(
            (candidate) =>
              note.timeBeat >= candidate.startBeat - 1e-9 &&
              note.timeBeat < candidate.startBeat + candidate.durationBeats - 1e-9,
          );
          expect(chord).toBeDefined();
          expect([...chord!.bassMidi, ...chord!.bodyMidi]).toContain(note.pitch);
          expect(note.pitch).toBeGreaterThanOrEqual(0);
          expect(note.pitch).toBeLessThanOrEqual(127);
          expect(note.timeBeat + note.durationBeat).toBeLessThanOrEqual(
            chord!.startBeat + chord!.durationBeats + 1e-9,
          );
        }
        const simultaneous = plan.notes
          .filter((note) => note.trackId === 'chord' || note.trackId === 'bass')
          .map((note) => `${note.timeBeat.toFixed(6)}:${note.pitch}`);
        expect(new Set(simultaneous).size).toBe(simultaneous.length);
      }
    }
  });

  it('keeps the slash bass at every candidate chord entry that includes LH', () => {
    const progression = GOLDEN_PROGRESSIONS.find((candidate) => candidate.id === 'D')!;
    for (const variant of CANDIDATES) {
      const plan = render(progression, variant, 'root');
      for (const chord of plan.chords) {
        const entry = plan.notes.filter(
          (note) =>
            Math.abs(note.timeBeat - chord.startBeat) <= 1e-9 &&
            (note.trackId === 'chord' || note.trackId === 'bass'),
        );
        expect(entry.length).toBeGreaterThan(0);
        expect(Math.min(...entry.map((note) => note.pitch))).toBe(chord.bassMidi[0]);
      }
    }
  });

  it('keeps candidate pedal deterministic and limited to Type2/Driving/Arpeggio', () => {
    const progression = GOLDEN_PROGRESSIONS[0]!;
    for (const variant of CANDIDATES) {
      const first = buildFinalMidiSnapshot(render(progression, variant, 'root'));
      const second = buildFinalMidiSnapshot(render(progression, variant, 'root'));
      expect(first).toEqual(second);
      const cc64 = first.controlChanges.filter((event) => event.controller === 64);
      if (variant === 'natural.type2' || variant === 'natural.type4' || variant === 'natural.type5')
        expect(cc64.length).toBeGreaterThan(0);
      else expect(cc64).toEqual([]);
    }
    for (const variant of ['natural.type2', 'natural.type4', 'natural.type5'] as const) {
      expect(
        buildFinalMidiSnapshot(render(progression, variant, 'root', 'releaseCut')).controlChanges,
      ).toEqual([]);
    }
  });

  it('keeps every promoted candidate legal across all twelve keys', () => {
    const source = GOLDEN_PROGRESSIONS[0]!;
    for (const key of MAJOR_KEYS) {
      const progression = { ...source, key };
      for (const variant of CANDIDATES) {
        const plan = render(progression, variant, 'root');
        expect(plan.harmonyViolations).toEqual([]);
        expect(
          plan.notes
            .filter((note) => note.trackId === 'chord' || note.trackId === 'bass')
            .every((note) => note.pitch >= 0 && note.pitch <= 127),
        ).toBe(true);
      }
    }
  });

  it('keeps the Build 13 candidate note schedules unchanged by regrouping and pedal', () => {
    const progression = GOLDEN_PROGRESSIONS[0]!;
    const actual = Object.fromEntries(
      (['natural.type2', 'natural.type3', 'natural.type4'] as const).map((variant) => [
        variant,
        candidateNoteDigest(render(progression, variant, 'root')),
      ]),
    );
    expect(actual).toEqual(BUILD13_NOTE_DIGESTS);
  });
});
