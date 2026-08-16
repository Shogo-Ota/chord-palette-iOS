/**
 * The accompaniment quality contract, as permanent regression gates.
 *
 * Every public style renders the Golden Progressions and must satisfy the hard
 * conditions the product is defined by:
 *
 *  - HARMONY   the user chord is the only source of pitch classes. No automatic
 *              extension, no passing note, no borrowed tone.
 *  - GATE      an effect may shorten a note but never lengthen one. Sustain rings
 *              through CC64, so silence and gap survive into the Final MIDI.
 *  - STRUCTURE no simultaneous duplicate pitch, everything inside MIDI 0–127, the
 *              slash bass is the lowest sounding note of its chord.
 *  - REGISTER  a style keeps its own hands in place across a chord change.
 *
 * The style-invariance gate (`STYLE MUST NOT CHANGE PITCH`) is declared here as a
 * known-failing contract: today each style owns a different base-voicing engine, so
 * it cannot hold yet. It is written as `it.failing` on purpose — when the shared
 * Compact Voicing Engine lands, this test starts passing and must be promoted.
 */

import { GOLDEN_PROGRESSIONS } from '@/lib/midiQa/goldenProgressions';
import {
  buildSessionPerformancePlan,
  type PerformanceSessionInput,
} from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import type { SessionPerformancePlan } from '@/lib/performance/finalMidi/types';
import type { InstrumentEffect } from '@/lib/performance/effect';
import { PUBLIC_ACCOMPANIMENT_PATTERNS } from '@/lib/performance/publicAccompaniment';
import { offeredVariantsFor } from '@/lib/performance/variants';
import { resolveAllowed } from '@/lib/performance/strictV2';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import type { AccompanimentPattern } from '@/types';

const PITCHED = new Set<NoteEvent['trackId']>(['chord', 'top', 'bass']);
/** An onset this far before a chord change already belongs to the new chord. */
const ANTICIPATION_BEATS = 1 / 8;

type Slot = { pattern: AccompanimentPattern; variantId: string };

const PUBLIC_SLOTS: Slot[] = PUBLIC_ACCOMPANIMENT_PATTERNS.flatMap((pattern) =>
  offeredVariantsFor(pattern).map((variant) => ({ pattern, variantId: variant.id })),
);

function plan(
  slot: Slot,
  progression: (typeof GOLDEN_PROGRESSIONS)[number],
  effect: InstrumentEffect = 'sustain',
): SessionPerformancePlan {
  const session: PerformanceSessionInput = {
    key: progression.key,
    tempoBpm: progression.bpm,
    grooveId: 'pop8',
    accompanimentPattern: slot.pattern,
    accompanimentVariant: slot.variantId as PerformanceSessionInput['accompanimentVariant'],
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift: 0,
    releaseCut: false,
    instrumentEffect: effect,
    drumMode: 'off',
    progression: progression.chords,
  };
  return buildSessionPerformancePlan(session, 'free');
}

function pc(pitch: number): number {
  return ((pitch % 12) + 12) % 12;
}

/** Notes that sound inside a chord's own window, anticipation included. */
function notesInChord(source: SessionPerformancePlan, chordIndex: number): NoteEvent[] {
  const chord = source.chords[chordIndex]!;
  const start = chord.startBeat;
  const end = chord.startBeat + chord.durationBeats;
  return source.notes.filter(
    (n) =>
      PITCHED.has(n.trackId) && n.timeBeat >= start - ANTICIPATION_BEATS && n.timeBeat < end - 1e-9,
  );
}

describe('accompaniment quality contract — HARMONY', () => {
  it.each(PUBLIC_SLOTS)('$pattern/$variantId sounds only user chord tones', (slot) => {
    for (const progression of GOLDEN_PROGRESSIONS) {
      const rendered = plan(slot, progression);
      // The production gate must agree: it detects illegal pitch without repairing.
      expect(rendered.harmonyViolations ?? []).toEqual([]);

      rendered.chords.forEach((chord, chordIndex) => {
        if (!chord.harmony) return;
        const allowed = new Set(resolveAllowed(chord.harmony).pcs);
        if (chord.harmony.slashBassPc != null) allowed.add(pc(chord.harmony.slashBassPc));
        const illegal = notesInChord(rendered, chordIndex)
          .map((n) => pc(n.pitch))
          .filter((value) => !allowed.has(value));
        expect(illegal).toEqual([]);
      });
    }
  });

  it.each(PUBLIC_SLOTS)('$pattern/$variantId adds no extension the user did not ask for', (slot) => {
    // Golden E walks C → Cadd9 → Cmaj7 → C7 on one root: a style that quietly
    // upgrades a plain triad shows up here as a 9th, major 7th or ♭7 over bar 1.
    const progression = GOLDEN_PROGRESSIONS.find((p) => p.id === 'E')!;
    const rendered = plan(slot, progression);
    const plainTriad = rendered.chords[0]!;
    const allowed = new Set(resolveAllowed(plainTriad.harmony!).pcs);
    const sounded = new Set(notesInChord(rendered, 0).map((n) => pc(n.pitch)));
    for (const value of sounded) expect(allowed.has(value)).toBe(true);
  });
});

describe('accompaniment quality contract — GATE', () => {
  it.each(PUBLIC_SLOTS)(
    '$pattern/$variantId never lengthens a note to imitate a pedal',
    (slot) => {
      for (const progression of GOLDEN_PROGRESSIONS) {
        const written = plan(slot, progression, 'off');
        const sustained = plan(slot, progression, 'sustain');
        expect(sustained.notes.map((n) => n.durationBeat)).toEqual(
          written.notes.map((n) => n.durationBeat),
        );
      }
    },
  );

  it.each(PUBLIC_SLOTS)('$pattern/$variantId rings through CC64, never twice', (slot) => {
    for (const progression of GOLDEN_PROGRESSIONS) {
      const written = plan(slot, progression, 'off');
      const sustained = plan(slot, progression, 'sustain');
      const cc64 = buildFinalMidiSnapshot(sustained).controlChanges.filter(
        (cc) => cc.controller === 64,
      );
      const stretched = sustained.notes.some(
        (note, index) => note.durationBeat > (written.notes[index]?.durationBeat ?? 0) + 1e-9,
      );
      // Pedal and stretched lengths would ring the same gesture twice.
      expect(stretched && cc64.length > 0).toBe(false);
    }
  });

  it('keeps City Type1 silent between every chord stab', () => {
    // City's identity is short stabs with real silence. A future effect or gate
    // change that fills that silence has to fail here.
    const slot: Slot = { pattern: 'city', variantId: 'city.type1' };
    for (const progression of GOLDEN_PROGRESSIONS) {
      const rendered = plan(slot, progression);
      const attacks = [...new Set(rendered.notes.map((n) => n.timeBeat))].sort((a, b) => a - b);
      for (let i = 0; i < attacks.length - 1; i += 1) {
        const release = Math.max(
          ...rendered.notes
            .filter((n) => n.timeBeat === attacks[i])
            .map((n) => n.timeBeat + n.durationBeat),
        );
        expect(release).toBeLessThanOrEqual(attacks[i + 1]! + 1e-9);
      }
    }
  });
});

describe('accompaniment quality contract — STRUCTURE', () => {
  it.each(PUBLIC_SLOTS)('$pattern/$variantId emits no simultaneous duplicate pitch', (slot) => {
    for (const progression of GOLDEN_PROGRESSIONS) {
      const rendered = plan(slot, progression);
      const seen = new Map<string, number>();
      for (const note of rendered.notes) {
        if (!PITCHED.has(note.trackId)) continue;
        const key = `${note.timeBeat.toFixed(5)}:${note.pitch}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      expect([...seen.entries()].filter(([, count]) => count > 1)).toEqual([]);
    }
  });

  it.each(PUBLIC_SLOTS)('$pattern/$variantId stays inside MIDI 0–127', (slot) => {
    for (const progression of GOLDEN_PROGRESSIONS) {
      for (const note of plan(slot, progression).notes) {
        expect(note.pitch).toBeGreaterThanOrEqual(0);
        expect(note.pitch).toBeLessThanOrEqual(127);
      }
    }
  });

  it.each(PUBLIC_SLOTS)('$pattern/$variantId honours an explicit slash bass', (slot) => {
    const progression = GOLDEN_PROGRESSIONS.find((p) => p.id === 'D')!;
    const rendered = plan(slot, progression);
    const slashIndex = rendered.chords.findIndex((c) => c.harmony?.slashBassPc != null);
    expect(slashIndex).toBeGreaterThanOrEqual(0);
    const notes = notesInChord(rendered, slashIndex);
    expect(notes.length).toBeGreaterThan(0);
    const lowest = Math.min(...notes.map((n) => n.pitch));
    expect(pc(lowest)).toBe(pc(rendered.chords[slashIndex]!.harmony!.slashBassPc!));
  });
});

describe('accompaniment quality contract — REGISTER', () => {
  it.each(PUBLIC_SLOTS)('$pattern/$variantId keeps its hands in place across a change', (slot) => {
    for (const progression of GOLDEN_PROGRESSIONS) {
      const rendered = plan(slot, progression);
      const perChord = rendered.chords
        .map((_, index) => notesInChord(rendered, index).map((n) => n.pitch))
        .filter((pitches) => pitches.length > 0);
      for (let i = 1; i < perChord.length; i += 1) {
        const previous = perChord[i - 1]!;
        const current = perChord[i]!;
        expect(Math.abs(Math.min(...current) - Math.min(...previous))).toBeLessThan(12);
        expect(Math.abs(Math.max(...current) - Math.max(...previous))).toBeLessThan(15);
      }
    }
  });
});

describe('accompaniment quality contract — STYLE PITCH INVARIANCE', () => {
  // KNOWN OPEN (ledger blocker `style-pitch-variance`). Block reads
  // src/lib/voicing.ts, City reads chordComping/fullVoicing.ts and Natural solves
  // every attack in humanTemplate/voiceStructureRealize.ts, so the same chord lands
  // in three different places. When the shared Compact Voicing Engine lands this
  // starts passing and must be turned into a plain `it`.
  it.failing('the same chord sounds at the same pitch whatever the style', () => {
    for (const progression of GOLDEN_PROGRESSIONS) {
      const byPattern = PUBLIC_ACCOMPANIMENT_PATTERNS.map((pattern) => {
        const slot: Slot = { pattern, variantId: offeredVariantsFor(pattern)[0]!.id };
        const rendered = plan(slot, progression);
        return rendered.chords.map((_, index) =>
          [...new Set(notesInChord(rendered, index).map((n) => n.pitch))]
            .sort((a, b) => a - b)
            .join(','),
        );
      });
      const chordCount = Math.max(...byPattern.map((c) => c.length));
      for (let index = 0; index < chordCount; index += 1) {
        const sets = new Set(byPattern.map((c) => c[index]).filter(Boolean));
        expect(sets.size).toBe(1);
      }
    }
  });
});
