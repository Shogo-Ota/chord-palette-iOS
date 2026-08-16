import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { humanTemplateById } from '@/lib/performance/humanTemplate';
import type { HumanMidiTemplate } from '@/lib/performance/humanTemplate/types';
import {
  applyVoicingMask,
  buildStableFullVoicings,
  realizeAtomicNaturalType1,
  validateAtomicNatural,
} from '@/lib/performance/naturalAtomic';
import { PHASE3C_CASES } from '@/lib/playback/phase3cCases';
import type { ChordEvent } from '@/types';

function atomicFor(session = PHASE3C_CASES['natural-type1'].session) {
  const current = buildSessionPerformancePlan(session, 'free');
  const template = humanTemplateById(current.humanTemplateId!);
  if (!template) throw new Error(`missing template ${current.humanTemplateId}`);
  return {
    current,
    template,
    atomic: realizeAtomicNaturalType1(template, current.chords, current.seed),
  };
}

function extensionProgression(base: readonly ChordEvent[]): ChordEvent[] {
  const definitions = [
    ['C', ''],
    ['Cadd9', 'add9'],
    ['Cmaj7', 'maj7'],
    ['C7', '7'],
  ] as const;
  return definitions.map(([displayName, suffix], index) => ({
    ...base[index]!,
    id: `atomic-extension-${index}`,
    chordId: `atomic-extension-${index}`,
    displayName,
    rootOffset: 0,
    suffix,
  }));
}

function slashProgression(base: readonly ChordEvent[]): ChordEvent[] {
  return base.map((chord, index) =>
    index === 1
      ? {
          ...chord,
          id: 'atomic-slash-g-over-b',
          chordId: 'atomic-slash-g-over-b',
          displayName: 'G/B',
          rootOffset: 7,
          suffix: '',
          bassOffset: 11,
        }
      : { ...chord, id: `atomic-slash-${index}`, chordId: `atomic-slash-${index}` },
  );
}

describe('Natural Atomic Chord', () => {
  it('builds one stable legal Full Voicing per user chord', () => {
    const { current, atomic } = atomicFor();

    expect(atomic.fullVoicings).toHaveLength(current.chords.length);
    for (const voicing of atomic.fullVoicings) {
      const pitches = voicing.notes.map((note) => note.pitch);
      expect(pitches.length).toBeGreaterThanOrEqual(4);
      expect(new Set(pitches).size).toBe(pitches.length);
      expect(pitches).toEqual([...pitches].sort((left, right) => left - right));
      expect(voicing.notes.filter((note) => note.handRole === 'LEFT')).toHaveLength(1);
      expect(voicing.notes[0]!.handRole).toBe('LEFT');
      expect(voicing.notes.slice(1).every((note) => note.handRole === 'RIGHT')).toBe(true);
      expect(
        voicing.notes.every((note) =>
          voicing.chord.harmony!.chordIntervals.some(
            (interval) => (voicing.chord.harmony!.rootPc + interval + 120) % 12 === note.pc,
          ),
        ),
      ).toBe(true);
    }
  });

  it('uses attack groups as atomic simultaneous gestures', () => {
    const { atomic } = atomicFor();

    for (const attack of atomic.attacks) {
      const notes = atomic.notes.filter(
        (note) => Math.abs(note.timeBeat - attack.onsetBeat) <= 1e-9,
      );
      expect(notes.length).toBeGreaterThan(0);
      expect(new Set(notes.map((note) => note.durationBeat))).toEqual(
        new Set([attack.durationBeat]),
      );
      expect(new Set(notes.map((note) => note.velocity))).toEqual(new Set([attack.velocity]));
    }
  });

  it('treats every mask as subtraction from the Full Voicing', () => {
    const { atomic } = atomicFor();
    for (const voicing of atomic.fullVoicings) {
      const full = new Set(voicing.notes.map((note) => note.pitch));
      for (const mask of ['FULL', 'TRIAD', 'ROOT_ONLY', 'SHELL', 'UPPER'] as const) {
        const selected = applyVoicingMask(voicing, mask);
        expect(selected.length).toBeGreaterThan(0);
        expect(selected.every((note) => full.has(note.pitch))).toBe(true);
      }
    }
    const rootOnly = applyVoicingMask(atomic.fullVoicings[0]!, 'ROOT_ONLY');
    expect(rootOnly).toHaveLength(1);
    expect(rootOnly[0]!.handRole).toBe('LEFT');
    expect(rootOnly[0]!.pitch).toBe(
      atomic.fullVoicings[0]!.notes.find((note) => note.handRole === 'LEFT')!.pitch,
    );
    const upper = applyVoicingMask(atomic.fullVoicings[0]!, 'UPPER');
    expect(upper.every((note) => note.handRole === 'RIGHT')).toBe(true);
  });

  it('does not read teacher pitch or degree mapping', () => {
    const { current, template, atomic } = atomicFor();
    const pitchScrambled: HumanMidiTemplate = {
      ...template,
      attacks: template.attacks.map((attack) => ({
        ...attack,
        notes: attack.notes.map((note) => ({
          ...note,
          absolutePitch: 127 - (note.absolutePitch ?? 60),
          sourceRootPc: ((note.sourceRootPc ?? 0) + 5) % 12,
          intervalFromRoot: (note.intervalFromRoot ?? 0) + 6,
          degree: note.degree === 'root' ? 'ninth' : 'root',
          chordRole: note.chordRole === 'root' ? 'ninth' : 'root',
        })),
      })),
    };
    const scrambled = realizeAtomicNaturalType1(pitchScrambled, current.chords, current.seed);

    expect(scrambled.fullVoicings).toEqual(atomic.fullVoicings);
    expect(scrambled.attacks).toEqual(atomic.attacks);
    expect(scrambled.notes).toEqual(atomic.notes);
  });

  it('keeps the Full Voicing progression independent of Natural Type timeline', () => {
    const { current } = atomicFor();
    const reference = buildStableFullVoicings(current.chords);
    for (const variant of ['natural.type1', 'natural.type2', 'natural.type3'] as const) {
      const plan = buildSessionPerformancePlan(
        { ...PHASE3C_CASES['natural-type1'].session, accompanimentVariant: variant },
        'free',
      );
      expect(buildStableFullVoicings(plan.chords)).toEqual(reference);
    }
  });

  it('keeps LH and RH register bands continuous across chord changes', () => {
    const { atomic } = atomicFor();
    const left = atomic.fullVoicings.map(
      (voicing) => voicing.notes.find((note) => note.handRole === 'LEFT')!.pitch,
    );
    const rightCenters = atomic.fullVoicings.map((voicing) => {
      const pitches = voicing.notes
        .filter((note) => note.handRole === 'RIGHT')
        .map((note) => note.pitch);
      return pitches.reduce((sum, pitch) => sum + pitch, 0) / pitches.length;
    });
    const leftJumps = left.slice(1).map((pitch, index) => Math.abs(pitch - left[index]!));
    const rightCenterJumps = rightCenters
      .slice(1)
      .map((center, index) => Math.abs(center - rightCenters[index]!));

    expect(Math.max(...leftJumps)).toBeLessThan(12);
    expect(Math.max(...rightCenterJumps)).toBeLessThan(12);
    expect(
      atomic.fullVoicings.every((voicing) =>
        voicing.notes.every((note) => note.pitch >= 0 && note.pitch <= 127),
      ),
    ).toBe(true);
  });

  it('preserves every selected extension color within its chord phrase', () => {
    const base = PHASE3C_CASES['natural-type1'].session;
    const { atomic } = atomicFor({
      ...base,
      progression: extensionProgression(base.progression),
    });
    const report = validateAtomicNatural(atomic);

    expect(report.colorPresencePass).toBe(true);
    expect(report.failures.filter((failure) => failure.code === 'color_presence')).toEqual([]);
    expect(atomic.attacks.filter((attack) => attack.mask === 'FULL')).toHaveLength(4);
    expect(
      atomic.fullVoicings
        .flatMap((voicing) => voicing.notes)
        .filter((note) => ['seventh', 'ninth', 'eleventh', 'thirteenth'].includes(note.degree))
        .every((note) => note.handRole === 'RIGHT'),
    ).toBe(true);
  });

  it('passes all automated Natural hard gates', () => {
    const { atomic } = atomicFor();
    expect(validateAtomicNatural(atomic)).toMatchObject({
      pass: true,
      userChordLegalityPct: 100,
      duplicateSimultaneousMidi: 0,
      invalidVoiceCrossing: 0,
      slashBassPass: true,
      colorPresencePass: true,
    });
  });

  it('keeps the specified slash bass as the lowest note in every mask', () => {
    const base = PHASE3C_CASES['natural-type1'].session;
    const { atomic } = atomicFor({
      ...base,
      progression: slashProgression(base.progression),
    });
    const report = validateAtomicNatural(atomic);
    const slashAttacks = atomic.attacks.filter((attack) => attack.chordIndex === 1);

    expect(report.slashBassPass).toBe(true);
    for (const attack of slashAttacks) {
      const pitches = atomic.notes
        .filter((note) => Math.abs(note.timeBeat - attack.onsetBeat) <= 1e-9)
        .map((note) => note.pitch);
      expect(Math.min(...pitches) % 12).toBe(11);
    }
    const slashVoicing = atomic.fullVoicings[1]!;
    expect(applyVoicingMask(slashVoicing, 'ROOT_ONLY')).toEqual([
      slashVoicing.notes.find((note) => note.handRole === 'LEFT'),
    ]);
    expect(applyVoicingMask(slashVoicing, 'UPPER').every((note) => note.handRole === 'RIGHT')).toBe(
      true,
    );
  });
});
