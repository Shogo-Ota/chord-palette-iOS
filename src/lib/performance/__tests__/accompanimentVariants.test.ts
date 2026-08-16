import { ACCOMPANIMENT_IDS } from '@/data/labels';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import { generatePerformance, type PerfChord } from '@/lib/performance/PerformanceEngine';
import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import { defaultVariantFor, offeredVariantsFor, resolveVariant, variantsFor } from '@/lib/performance/variants';
import type { AccompanimentPattern, ChordEvent } from '@/types';

const BPM = 100;

/** Eight bars of I–V–vi–IV, long enough for two 4-bar phrases of any rotation. */
function chords(): PerfChord[] {
  const roots = [60, 67, 69, 65, 60, 67, 69, 65];
  return roots.map((root, bar) => ({
    bodyMidi: [root, root + 4, root + 7],
    bassMidi: [root - 24],
    arpMidi: [root, root + 4, root + 7, root + 11],
    harmony: {
      symbol: `root-${root}`,
      rootPc: root % 12,
      quality: 'major',
      chordIntervals: [0, 4, 7],
    },
    startBeat: bar * 4,
    durationBeats: 4,
  }));
}

function render(pattern: AccompanimentPattern, variantId?: string, bpm = BPM): NoteEvent[] {
  return generatePerformance(
    { chords: chords(), bpm, seed: 7 },
    { styleId: pattern, variantId, drums: false },
  );
}

/**
 * Patterns whose readings are Types — a different human take rather than a different
 * synthetic skeleton. A Type is resolved where the session is turned into a plan, so
 * these are compared through that path.
 */
const TYPED_PATTERNS: readonly AccompanimentPattern[] = ['natural', 'arpeggio'];

function namesTypes(pattern: AccompanimentPattern): boolean {
  return variantsFor(pattern).some((v) => v.humanTemplateId);
}

/** The production path: session → plan, the one playback and export both use. */
function planFor(pattern: AccompanimentPattern, variantId?: string): NoteEvent[] {
  return buildSessionPerformancePlan({
    key: 'C',
    tempoBpm: BPM,
    grooveId: 'pop8',
    accompanimentPattern: pattern,
    accompanimentVariant: variantId,
    instrumentId: 'piano',
    accompanimentEnergy: 'build',
    octaveShift: 1,
    releaseCut: false,
    instrumentEffect: 'sustain',
    drumMode: 'off',
    progression: [0, 7, 9, 5].map(
      (rootOffset, i) =>
        ({
          id: `v${i}`,
          chordId: `v${i}`,
          displayName: `v${i}`,
          degreeLabel: 'I',
          function: 'tonic',
          durationBeats: 4,
          isPro: false,
          rootOffset,
          suffix: '',
        }) as ChordEvent,
    ),
  }).notes;
}

/** A take's identity: which pitch sounds when, for how long, how hard. */
function signature(notes: NoteEvent[]): string {
  return notes
    .map((n) => `${n.trackId}@${n.timeBeat.toFixed(4)}:${n.pitch}:${n.durationBeat.toFixed(4)}:${n.velocity}`)
    .join('|');
}

describe('the default variant is the sound that shipped', () => {
  it('renders identically whether or not the default id is passed', () => {
    for (const pattern of ACCOMPANIMENT_IDS) {
      const implicit = render(pattern);
      const explicit = render(pattern, defaultVariantFor(pattern).id);
      expect(signature(explicit)).toBe(signature(implicit));
    }
  });

  it('renders identically for a stale id, so a retired variant cannot break a project', () => {
    for (const pattern of ACCOMPANIMENT_IDS) {
      expect(signature(render(pattern, `${pattern}.retired`))).toBe(signature(render(pattern)));
    }
  });

  it('defaults Natural to Type 1 — a real teacher take', () => {
    expect(defaultVariantFor('natural').id).toBe('natural.type1');
    expect(defaultVariantFor('natural').humanTemplateId).toBeDefined();
  });

  it('still resolves the retired Natural rotation for saved projects', () => {
    expect(resolveVariant('natural', 'natural.auto').id).toBe('natural.auto');
    expect(resolveVariant('natural', 'natural.auto').bank).toHaveLength(3);
  });
});

describe('every variant is a real, playable alternative', () => {
  it('produces notes and changes the take', () => {
    // Checked at two tempos: a variant that only pins the skeleton (Driving's fixed
    // 8- and 16-feel) matches the automatic reading at whichever tempo would have
    // chosen the same base, and differs at the other. Being the same in one context
    // is the point of pinning; being the same in every context would be a no-op.
    const tempos = [90, 160];
    for (const pattern of ACCOMPANIMENT_IDS) {
      if (namesTypes(pattern)) {
        // A Type is a different teacher take: compared through the production path.
        for (const variant of offeredVariantsFor(pattern).slice(1)) {
          const notes = planFor(pattern, variant.id);
          expect(notes.length).toBeGreaterThan(0);
          expect(signature(notes)).not.toBe(signature(planFor(pattern)));
        }
        continue;
      }
      for (const variant of variantsFor(pattern).slice(1)) {
        const differs = tempos.map((bpm) => {
          const notes = render(pattern, variant.id, bpm);
          expect(notes.length).toBeGreaterThan(0);
          return signature(notes) !== signature(render(pattern, undefined, bpm));
        });
        expect(differs).toContain(true);
      }
    }
  });

  it('never leaves a bar without a chord voice', () => {
    for (const pattern of ACCOMPANIMENT_IDS) {
      for (const variant of variantsFor(pattern)) {
        const chordBars = new Set(
          render(pattern, variant.id)
            .filter((n) => n.trackId === 'chord')
            .map((n) => Math.floor(n.timeBeat / 4)),
        );
        for (let bar = 0; bar < 8; bar++) {
          expect(chordBars.has(bar)).toBe(true);
        }
      }
    }
  });

  it('stays deterministic — the same seed and variant give the same take', () => {
    for (const pattern of ACCOMPANIMENT_IDS) {
      for (const variant of variantsFor(pattern)) {
        expect(signature(render(pattern, variant.id))).toBe(
          signature(render(pattern, variant.id)),
        );
      }
    }
  });
});

describe('what the variants actually change', () => {
  it('each Type of ナチュラル / バリエーション is its own take', () => {
    for (const pattern of TYPED_PATTERNS) {
      const takes = offeredVariantsFor(pattern).map((v) => signature(planFor(pattern, v.id)));
      expect(new Set(takes).size).toBe(takes.length);
    }
  });

  it('Type 1 is what the pattern played before Types existed', () => {
    for (const pattern of TYPED_PATTERNS) {
      expect(signature(planFor(pattern, defaultVariantFor(pattern).id))).toBe(
        signature(planFor(pattern)),
      );
    }
  });

  it('Natural Sparse plays fewer bass notes than Dense', () => {
    const bass = (id: string) => render('natural', id).filter((n) => n.trackId === 'bass').length;
    expect(bass('natural.sparse')).toBeLessThan(bass('natural.dense'));
  });

  it('Natural Steady repeats one template where the rotation may not', () => {
    const bassSteps = (id: string, bar: number) =>
      render('natural', id)
        .filter((n) => n.trackId === 'bass' && Math.floor(n.timeBeat / 4) === bar)
        .length;
    // A fixed template plays the same bass count in every bar of the piece.
    const counts = [0, 1, 2, 3, 4, 5, 6, 7].map((bar) => bassSteps('natural.steady', bar));
    expect(new Set(counts).size).toBe(1);
  });

  it('named rhythms hold their bar at any tempo, where Driving picks by tempo', () => {
    // A named rhythm is a promise about the bar; Driving's promise is that it will
    // choose for you. The Variation layer reads no tempo, so counts are comparable.
    const chordCount = (pattern: AccompanimentPattern, bpm: number) =>
      render(pattern, undefined, bpm).filter((n) => n.trackId === 'chord').length;
    expect(chordCount('beat8', 160)).toBe(chordCount('beat8', 90));
    expect(chordCount('beat16', 160)).toBe(chordCount('beat16', 90));
    expect(chordCount('driving', 160)).not.toBe(chordCount('driving', 90));
  });

  it('16 Beat is denser than 8 Beat, and Shuffle hops where 8 Beat does not', () => {
    const chordsOf = (pattern: AccompanimentPattern) =>
      render(pattern).filter((n) => n.trackId === 'chord').length;
    expect(chordsOf('beat16')).toBeGreaterThan(chordsOf('beat8'));
    // Shuffle's swing moves the "&"; the attack times must differ from straight 8ths.
    const times = (pattern: AccompanimentPattern) =>
      render(pattern)
        .filter((n) => n.trackId === 'chord')
        .map((n) => n.timeBeat.toFixed(3))
        .join('|');
    expect(times('shuffle')).not.toBe(times('beat8'));
    expect(times('swing')).not.toBe(times('shuffle'));
  });

  it('Reggae skanks short where Bossa rings longer', () => {
    const longest = (pattern: AccompanimentPattern) =>
      Math.max(
        ...render(pattern)
          .filter((n) => n.trackId === 'chord')
          .map((n) => n.durationBeat),
      );
    expect(longest('reggae')).toBeLessThan(longest('bossa'));
  });

  it('block holds every chord tone for the chord and never uses a teacher take', () => {
    const session = {
      key: 'C' as const,
      tempoBpm: BPM,
      grooveId: 'pop8' as const,
      accompanimentPattern: 'block' as const,
      instrumentId: 'piano' as const,
      accompanimentEnergy: 'build' as const,
      octaveShift: 1,
      releaseCut: false,
      instrumentEffect: 'sustain' as const,
      drumMode: 'off' as const,
      progression: [0, 7, 9, 5].map(
        (rootOffset, i) =>
          ({
            id: `b${i}`,
            chordId: `b${i}`,
            displayName: `b${i}`,
            degreeLabel: 'I',
            function: 'tonic',
            durationBeats: 4,
            isPro: false,
            rootOffset,
            suffix: '',
          }) as ChordEvent,
      ),
    };
    const plan = buildSessionPerformancePlan(session);
    expect(plan.humanTemplateId).toBeUndefined();
    const chordNotes = plan.notes.filter((n) => n.trackId === 'chord');
    expect(chordNotes).toHaveLength(12);
    for (let bar = 0; bar < 4; bar++) {
      const inBar = chordNotes.filter(
        (n) => n.timeBeat >= bar * 4 - 0.05 && n.timeBeat < bar * 4 + 0.25,
      );
      expect(inBar).toHaveLength(3);
      expect(new Set(inBar.map((n) => n.timeBeat.toFixed(3))).size).toBe(1);
      for (const n of inBar) {
        expect(n.durationBeat).toBeGreaterThanOrEqual(4 * 0.9 - 1e-6);
      }
    }
  });

  it('a Type keeps the pattern recognisable — バラード still rings long', () => {
    for (const variant of variantsFor('relaxed')) {
      const chord = planFor('relaxed', variant.id).filter((n) => n.trackId === 'chord');
      expect(chord.length).toBeGreaterThan(0);
      expect(Math.max(...chord.map((n) => n.durationBeat))).toBeGreaterThanOrEqual(1);
    }
  });
});
