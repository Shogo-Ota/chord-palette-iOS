import { harmonicRoleVisuals } from '@/lib/videoExport/harmonicRoleVisuals';
import {
  isBorrowedInContext,
  visualHarmonicRoleInContext,
} from '@/lib/videoExport/visualHarmonicRole';
import type { ChordEvent, ChordFunction, KeyMode } from '@/types';

function chord(partial: Partial<ChordEvent>): ChordEvent {
  return {
    id: 'e1',
    displayName: 'Fm',
    degreeLabel: 'iv',
    rootOffset: 5,
    suffix: 'm',
    durationBeats: 4,
    keyContext: 'C',
    ...partial,
  } as ChordEvent;
}

/** The borrowed chords of C major, as taken from the minor grid: no technique is stated. */
const BORROWED: { name: string; rootOffset: number; suffix: string; fn: ChordFunction }[] = [
  { name: 'Fm', rootOffset: 5, suffix: 'm', fn: 'subdominant' },
  { name: 'Fm7', rootOffset: 5, suffix: 'm7', fn: 'subdominant' },
  { name: 'Gm7', rootOffset: 7, suffix: 'm7', fn: 'dominant' },
  { name: 'B♭7', rootOffset: 10, suffix: '7', fn: 'subdominant' },
  { name: 'A♭', rootOffset: 8, suffix: '', fn: 'subdominant' },
  { name: 'E♭maj7', rootOffset: 3, suffix: 'maj7', fn: 'tonic' },
];

describe('harmonic mode decides what counts as borrowed', () => {
  it.each(BORROWED)('reads $name as borrowed in a major song', ({ rootOffset, suffix, fn }) => {
    const event = chord({ rootOffset, suffix, function: fn, category: 'diatonic' });
    expect(isBorrowedInContext(event, 'major')).toBe(true);
  });

  it.each(BORROWED)('leaves $name alone in a minor song', ({ rootOffset, suffix, fn }) => {
    const event = chord({ rootOffset, suffix, function: fn, category: 'diatonic' });
    expect(isBorrowedInContext(event, 'minor')).toBe(false);
  });

  it('never treats the diatonic chords of C major as borrowed', () => {
    const diatonic = [
      { rootOffset: 0, suffix: '' },
      { rootOffset: 2, suffix: 'm' },
      { rootOffset: 4, suffix: 'm' },
      { rootOffset: 5, suffix: '' },
      { rootOffset: 7, suffix: '' },
      { rootOffset: 9, suffix: 'm' },
      { rootOffset: 11, suffix: 'm7-5' },
    ];
    for (const d of diatonic) {
      expect(isBorrowedInContext(chord({ ...d, category: 'diatonic' }), 'major')).toBe(false);
    }
  });

  it('does not mistake a secondary dominant or a passing diminished for a borrowing', () => {
    // E7 brings a G# and G#dim7 a B, and the parallel minor holds neither.
    expect(isBorrowedInContext(chord({ rootOffset: 4, suffix: '7' }), 'major')).toBe(false);
    expect(isBorrowedInContext(chord({ rootOffset: 8, suffix: 'dim7' }), 'major')).toBe(false);
  });
});

describe('a stated technique outranks what the pitches suggest', () => {
  it('keeps the backdoor dominant reading of B♭7', () => {
    const event = chord({
      rootOffset: 10,
      suffix: '7',
      function: 'subdominant',
      category: 'substituteChord',
    });
    expect(isBorrowedInContext(event, 'major')).toBe(false);
    expect(visualHarmonicRoleInContext(event, 'major').confidence).toBe('explicit');
  });

  it('keeps E♭maj7 a chromatic mediant', () => {
    const event = chord({ rootOffset: 3, suffix: 'maj7', category: 'chromaticMediant' });
    expect(visualHarmonicRoleInContext(event, 'major')).toEqual(
      visualHarmonicRoleInContext(event, 'minor'),
    );
  });
});

describe('borrowing colours by the force the chord applies', () => {
  it('gives a borrowed Fm7 the subdominant role', () => {
    const event = chord({ rootOffset: 5, suffix: 'm7', function: 'subdominant' });
    expect(visualHarmonicRoleInContext(event, 'major').role).toBe('motion');
  });

  it('gives a borrowed Gm7 the dominant role', () => {
    const event = chord({ rootOffset: 7, suffix: 'm7', function: 'dominant' });
    expect(visualHarmonicRoleInContext(event, 'major').role).toBe('tension');
  });
});

describe('the palette a chord was taken from does not change how it reads', () => {
  const routes: { label: string; event: ChordEvent }[] = [
    {
      label: 'the minor grid',
      event: chord({ id: 'grid', category: 'diatonic', modeContext: 'minor' }),
    },
    {
      label: 'the major grid',
      event: chord({ id: 'major-grid', category: 'diatonic', modeContext: 'major' }),
    },
    { label: 'no palette record at all', event: chord({ id: 'legacy' }) },
  ];

  it.each(routes)('reads the same Fm the same way from $label', ({ event }) => {
    const withFunction = { ...event, function: 'subdominant' as ChordFunction };
    expect(visualHarmonicRoleInContext(withFunction, 'major').role).toBe('motion');
    expect(harmonicRoleVisuals([withFunction], 'major')).toHaveLength(1);
  });
});

describe('the sidecar follows the song mode', () => {
  it('drops entirely for a plain major progression', () => {
    const progression = [
      chord({ id: 'a', rootOffset: 0, suffix: '', function: 'tonic', category: 'diatonic' }),
      chord({ id: 'b', rootOffset: 5, suffix: '', function: 'subdominant', category: 'diatonic' }),
      chord({ id: 'c', rootOffset: 7, suffix: '', function: 'dominant', category: 'diatonic' }),
    ];
    expect(harmonicRoleVisuals(progression, 'major')).toEqual([]);
  });

  it('marks only the borrowed position, at its own cycle index', () => {
    const progression = [
      chord({ id: 'a', rootOffset: 0, suffix: '', function: 'tonic', category: 'diatonic' }),
      chord({ id: 'b', rootOffset: 5, suffix: 'm7', function: 'subdominant', category: 'diatonic' }),
    ];
    const visuals = harmonicRoleVisuals(progression, 'major');
    expect(visuals).toHaveLength(1);
    expect(visuals[0]?.cycleIndex).toBe(1);
  });

  it('marks nothing when the same progression is declared minor', () => {
    const progression = [
      chord({ id: 'a', rootOffset: 0, suffix: 'm', function: 'tonic', category: 'diatonic' }),
      chord({ id: 'b', rootOffset: 5, suffix: 'm7', function: 'subdominant', category: 'diatonic' }),
    ];
    expect(harmonicRoleVisuals(progression, 'minor')).toEqual([]);
  });

  it('reads as major when no mode is given, so existing callers keep working', () => {
    const borrowed = chord({ rootOffset: 5, suffix: 'm7', function: 'subdominant' });
    expect(harmonicRoleVisuals([borrowed])).toEqual(harmonicRoleVisuals([borrowed], 'major'));
  });
});

describe('an explicit Modal Interchange chord reads the same in either palette', () => {
  const modeMatrix: KeyMode[] = ['major', 'minor'];
  it.each(modeMatrix)('from the %s palette', (paletteMode) => {
    const event = chord({
      chordId: 'modal-C-IVm',
      category: 'modalInterchange',
      function: 'subdominant',
      modeContext: paletteMode,
    });
    expect(visualHarmonicRoleInContext(event, 'major').role).toBe('motion');
  });
});
