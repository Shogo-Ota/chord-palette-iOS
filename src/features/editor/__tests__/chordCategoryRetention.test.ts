import { PRESETS, STARTER_PRESET } from '@/data/presets';
import { modalInterchange, secondaryDominants, variationChord } from '@/data/music';
import * as session from '@/features/editor/session';
import { buildPresetProgression } from '@/lib/presets';
import { suggestionToChordEvent } from '@/lib/theory/progression/suggestNext';
import { transposeEvent } from '@/lib/transpose';
import type { ChordEvent, LibraryChord, MajorKey, Preset } from '@/types';

/**
 * `category` says what harmonic technique a chord is an instance of, and nothing
 * reconstructs it: there is no inference from a root, a suffix or a degree label anywhere,
 * by design. That makes it fragile in one specific way — any construction site that forgets
 * to carry it silently turns a borrowed chord into an ordinary one, with no error and no
 * visible symptom until something downstream asks.
 *
 * Two sites had forgotten. These tests exist so a third cannot.
 */

const KEY: MajorKey = 'C';

function preset(id: string): Preset {
  const found = [...PRESETS, STARTER_PRESET].find((p) => p.id === id);
  if (!found) throw new Error(`no preset ${id}`);
  return found;
}

function eventFrom(chord: LibraryChord): Omit<ChordEvent, 'id'> {
  return {
    chordId: chord.id,
    displayName: chord.displayName,
    degreeLabel: chord.degreeLabel,
    function: chord.function,
    durationBeats: 4,
    isPro: !!chord.isPro,
    rootOffset: chord.rootOffset,
    suffix: chord.suffix,
    definitionId: chord.definitionId,
    variation: chord.variation,
    category: chord.category,
  };
}

/** The degree the editor resolves for a chord rooted a perfect fourth above the tonic. */
const IV = 3;

describe('A. a preset states its own techniques', () => {
  it('carries the borrowed chords of 泣きの借用 through to placed events', () => {
    const built = buildPresetProgression(preset('borrowed-ballad'), KEY);
    expect(built.map((event) => [event.displayName, event.category])).toEqual([
      ['C', undefined],
      ['B♭', 'modalInterchange'],
      ['Fm', 'modalInterchange'],
      ['C', undefined],
    ]);
  });

  it('carries secondary dominants and the borrowed v through おしゃれ循環', () => {
    const built = buildPresetProgression(preset('jazzy-loop'), KEY);
    expect(built.map((event) => [event.displayName, event.category])).toEqual([
      ['Fmaj7', undefined],
      ['E7', 'secondaryDominant'],
      ['Am7', undefined],
      ['Gm7', 'modalInterchange'],
      ['C7', 'secondaryDominant'],
    ]);
  });

  it('reads on-chords from the bass they are built on', () => {
    const built = buildPresetProgression(preset('descending-bass'), KEY);
    for (const event of built) {
      expect({
        chord: event.displayName,
        category: event.category,
      }).toEqual({
        chord: event.displayName,
        category: event.bassOffset != null ? 'slash' : undefined,
      });
    }
  });

  /**
   * Silence is the right answer for a plain diatonic chord. Labelling everything would make
   * the field a restatement of the chord rather than a claim about it.
   */
  it('leaves a plain diatonic chord unlabelled in every preset', () => {
    for (const p of [...PRESETS, STARTER_PRESET]) {
      for (const chord of p.chords) {
        if (chord.chordCategory != null || chord.bassOffset != null) continue;
        const built = buildPresetProgression(p, KEY);
        expect(built.every((event) => event.category !== 'variation')).toBe(true);
      }
    }
  });

  it('declares a technique only where one is actually defined', () => {
    const declared = [...PRESETS, STARTER_PRESET].flatMap((p) =>
      p.chords.flatMap((chord) => (chord.chordCategory ? [chord.chordCategory] : [])),
    );
    expect(new Set(declared)).toEqual(new Set(['secondaryDominant', 'modalInterchange']));
  });

  it('matches what the theory tables call those chords', () => {
    const borrowed = new Set(modalInterchange(KEY).map((chord) => chord.rootOffset));
    const secondary = new Set(secondaryDominants(KEY).map((chord) => chord.rootOffset));
    for (const p of [...PRESETS, STARTER_PRESET]) {
      for (const chord of p.chords) {
        if (chord.chordCategory === 'modalInterchange') {
          expect({ id: p.id, offset: chord.offset, known: borrowed.has(chord.offset) }).toEqual({
            id: p.id,
            offset: chord.offset,
            known: true,
          });
        }
        if (chord.chordCategory === 'secondaryDominant') {
          expect({ id: p.id, offset: chord.offset, known: secondary.has(chord.offset) }).toEqual({
            id: p.id,
            offset: chord.offset,
            known: true,
          });
        }
      }
    }
  });
});

describe('B. a suggestion keeps where it came from', () => {
  it('stamps a borrowed suggestion as borrowed', () => {
    const placed = suggestionToChordEvent({
      rootOffset: 5,
      suffix: 'm',
      function: 'subdominant',
      degreeLabel: 'IVm',
      displayName: 'Fm',
      isPro: true,
      reason: 'modal',
      score: 0.48,
    });
    expect(placed.category).toBe('modalInterchange');
  });
});

describe('C–G. editing a chord does not erase where it came from', () => {
  const borrowedFm = (): Omit<ChordEvent, 'id'> => ({
    chordId: 'sugg-5-m',
    displayName: 'Fm',
    degreeLabel: 'IVm',
    function: 'subdominant',
    durationBeats: 4,
    isPro: true,
    rootOffset: 5,
    suffix: 'm',
    category: 'modalInterchange',
  });

  beforeEach(() => {
    session.clearProgression();
    session.setKey(KEY);
  });

  function placeBorrowed(): ChordEvent {
    session.addChord(borrowedFm());
    const { progression } = session.getSession();
    return progression[progression.length - 1]!;
  }

  it('C. survives a key change', () => {
    const placed = placeBorrowed();
    expect(transposeEvent(placed, 'G').category).toBe('modalInterchange');
  });

  it('D. survives a duration change', () => {
    placeBorrowed();
    session.setSelected(0);
    session.setDuration(2);
    expect(session.getSession().progression[0]!.category).toBe('modalInterchange');
  });

  /**
   * The case that broke. A variation is a decoration, not an origin: `Fm` borrowed from the
   * parallel minor is still borrowed once it becomes `Fm(add9)`.
   */
  it('E. survives having a variation applied, and records the variation separately', () => {
    placeBorrowed();
    session.setSelected(0);
    const decoration = variationChord(KEY, IV, 'add9');
    const { durationBeats: _ignored, ...patch } = eventFrom(decoration);
    session.applyVariationToSelected(patch);

    const [event] = session.getSession().progression;
    expect(event!.displayName).toBe('Fadd9');
    expect(event!.variation).toBe('add9');
    expect(event!.category).toBe('modalInterchange');
  });

  it('E. never writes the decoration itself as an origin', () => {
    session.addChord({ ...borrowedFm(), category: undefined });
    session.setSelected(0);
    const { durationBeats: _ignored, ...patch } = eventFrom(variationChord(KEY, IV, 'add9'));
    session.applyVariationToSelected(patch);
    expect(session.getSession().progression[0]!.category).toBeUndefined();
  });

  it('G. does update the origin when the chord is genuinely replaced', () => {
    placeBorrowed();
    session.setSelected(0);
    const replacement = secondaryDominants(KEY).find((chord) => chord.displayName === 'E7')!;
    const { durationBeats: _ignored, ...patch } = eventFrom(replacement);
    session.replaceSelected(patch);

    const [event] = session.getSession().progression;
    expect(event!.displayName).toBe('E7');
    expect(event!.category).toBe('secondaryDominant');
  });
});
