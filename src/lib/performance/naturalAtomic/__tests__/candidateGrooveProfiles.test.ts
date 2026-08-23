import {
  compatibilityMaskForSelection,
  selectNaturalAttackNotes,
  type NaturalAttackVoicingSelection,
} from '@/lib/performance/naturalAtomic/attackVoicingPolicy';
import { CANDIDATE_GROOVE_PROFILES } from '@/lib/performance/naturalAtomic/candidateGrooveProfiles';
import type { FullVoicing } from '@/lib/performance/naturalAtomic/types';

const VOICING = {
  chordIndex: 0,
  chord: {} as FullVoicing['chord'],
  notes: [
    {
      pitch: 43,
      pc: 7,
      interval: 0,
      degree: 'root',
      handRole: 'LEFT',
      isBass: true,
      isDuplicate: false,
    },
    {
      pitch: 55,
      pc: 7,
      interval: 0,
      degree: 'root',
      handRole: 'RIGHT',
      isBass: false,
      isDuplicate: false,
    },
    {
      pitch: 59,
      pc: 11,
      interval: 4,
      degree: 'third',
      handRole: 'RIGHT',
      isBass: false,
      isDuplicate: false,
    },
    {
      pitch: 62,
      pc: 2,
      interval: 7,
      degree: 'fifth',
      handRole: 'RIGHT',
      isBass: false,
      isDuplicate: false,
    },
    {
      pitch: 65,
      pc: 5,
      interval: 10,
      degree: 'seventh',
      handRole: 'RIGHT',
      isBass: false,
      isDuplicate: false,
    },
  ],
} as const satisfies FullVoicing;

describe('promoted Natural candidate profiles', () => {
  it('keeps one four-bar temporal source for every promoted Type', () => {
    expect(
      Object.values(CANDIDATE_GROOVE_PROFILES).map((profile) => [
        profile.id,
        profile.sourceCandidateId,
        profile.bars.map((bar) => bar.length),
      ]),
    ).toEqual([
      ['natural.type2', 'STYLE_CANDIDATE_01', [6, 6, 6, 6]],
      ['natural.type3', 'STYLE_CANDIDATE_02', [9, 9, 9, 8]],
      ['natural.type4', 'STYLE_CANDIDATE_03', [12, 12, 12, 10]],
      ['natural.type5', 'STYLE_CANDIDATE_04', [7, 7, 7, 7]],
    ]);
  });

  it('stores no source pitch, pitch class, key or chord progression', () => {
    const serialized = JSON.stringify(CANDIDATE_GROOVE_PROFILES);
    for (const forbidden of ['"pitch"', '"pc"', '"key"', '"chord"', '"progression"']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('gives Type2 and Driving their independent controlled pedal envelopes', () => {
    const type2 = CANDIDATE_GROOVE_PROFILES['natural.type2'];
    expect(type2.pedalByBar[0]!.map((event) => [event.onsetBeat, event.value])).toEqual([
      [0, 96],
      [3.9, 0],
    ]);
    expect(
      CANDIDATE_GROOVE_PROFILES['natural.type4'].pedalByBar[0]!.map((event) => [
        event.onsetBeat,
        event.value,
      ]),
    ).toEqual([
      [0, 92],
      [0.82, 0],
      [1, 92],
      [1.95, 0],
      [2, 92],
      [2.82, 0],
      [3, 92],
      [3.95, 0],
    ]);
    expect(CANDIDATE_GROOVE_PROFILES['natural.type3'].pedalByBar).toEqual([[], [], [], []]);
    for (const bar of CANDIDATE_GROOVE_PROFILES['natural.type5'].pedalByBar) {
      expect(bar).toEqual([
        { onsetBeat: 0, value: 96 },
        { onsetBeat: 3.9, value: 0 },
      ]);
    }
  });

  it.each([
    [{ kind: 'VOICE_ROLE', role: 'BASS' }, [43]],
    [{ kind: 'VOICE_ROLE', role: 'RH_BOTTOM' }, [55]],
    [{ kind: 'VOICE_ROLE', role: 'RH_MIDDLE' }, [62]],
    [{ kind: 'VOICE_ROLE', role: 'RH_TOP' }, [65]],
    [{ kind: 'VOICE_ROLES', roles: ['BASS', 'RH_BOTTOM'] }, [43, 55]],
    [{ kind: 'MASK', mask: 'FULL' }, [43, 55, 59, 62, 65]],
  ] as const)('selects %o only by subtraction from the Full Voicing', (selection, pitches) => {
    const selected = selectNaturalAttackNotes(VOICING, selection as NaturalAttackVoicingSelection);
    expect(selected.map((note) => note.pitch)).toEqual(pitches);
    expect(selected.every((note) => VOICING.notes.some((full) => full.pitch === note.pitch))).toBe(
      true,
    );
  });

  it('classifies a multi-role Bass/RH selection as a subtractive shell', () => {
    expect(
      compatibilityMaskForSelection({
        kind: 'VOICE_ROLES',
        roles: ['BASS', 'RH_BOTTOM'],
      }),
    ).toBe('SHELL');
  });

  it('keeps every Type5 Attack Group strictly single-note by voice role', () => {
    const type5 = CANDIDATE_GROOVE_PROFILES['natural.type5'];
    for (const bar of type5.bars) {
      expect(
        bar.map((attack) =>
          attack.selection.kind === 'VOICE_ROLE' ? attack.selection.role : 'MASK',
        ),
      ).toEqual(['BASS', 'RH_BOTTOM', 'RH_MIDDLE', 'RH_TOP', 'RH_MIDDLE', 'RH_BOTTOM', 'BASS']);
      for (const attack of bar) {
        expect(selectNaturalAttackNotes(VOICING, attack.selection)).toHaveLength(1);
      }
    }
  });
});
