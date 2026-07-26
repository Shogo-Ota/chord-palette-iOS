import { ACCOMPANIMENT_IDS } from '@/data/labels';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import { generatePerformance, type PerfChord } from '@/lib/performance/PerformanceEngine';
import { defaultVariantFor, variantsFor } from '@/lib/performance/variants';
import type { AccompanimentPattern } from '@/types';

const BPM = 100;

/** Eight bars of I–V–vi–IV, long enough for two 4-bar phrases of any rotation. */
function chords(): PerfChord[] {
  const roots = [60, 67, 69, 65, 60, 67, 69, 65];
  return roots.map((root, bar) => ({
    bodyMidi: [root, root + 4, root + 7],
    bassMidi: [root - 24],
    arpMidi: [root, root + 4, root + 7, root + 11],
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

  it('keeps the Natural rotation the default rather than a fixed template', () => {
    expect(defaultVariantFor('natural').id).toBe('natural.auto');
    expect(defaultVariantFor('natural').bank).toHaveLength(3);
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
  it('Block Half re-strikes twice a bar where Hold strikes once', () => {
    const perBar = (id: string) =>
      render('block', id).filter((n) => n.trackId === 'chord' && n.timeBeat < 4).length;
    // Hold plays the triad once; Half plays it on beats 1 and 3.
    expect(perBar('block.half')).toBe(perBar('block.hold') * 2);
  });

  it('Block Stab shortens the ring instead of holding it', () => {
    const longest = (id: string) =>
      Math.max(...render('block', id).filter((n) => n.trackId === 'chord').map((n) => n.durationBeat));
    expect(longest('block.stab')).toBeLessThan(longest('block.hold'));
  });

  it('Arpeggio Up only ever climbs within a chord', () => {
    const first = render('arpeggio', 'arpeggio.up')
      .filter((n) => n.trackId === 'chord' && n.timeBeat < 4)
      .sort((a, b) => a.timeBeat - b.timeBeat)
      .map((n) => n.pitch);
    // The cycle restarts at the bottom each time it tops out, so a descent of one
    // step never happens: the line either rises or drops back to the root.
    const descents = first.filter((p, i) => i > 0 && p < first[i - 1]);
    expect(descents.every((p) => p === first[0])).toBe(true);
  });

  it('Arpeggio 8th halves the note count of the 16th default', () => {
    const count = (id: string) =>
      render('arpeggio', id).filter((n) => n.trackId === 'chord').length;
    expect(count('arpeggio.eighth')).toBe(count('arpeggio.upDown') / 2);
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

  it('Relaxed Sustain drops the top voice and rings longer', () => {
    const ballad = render('relaxed', 'relaxed.ballad');
    const sustain = render('relaxed', 'relaxed.sustain');
    expect(ballad.some((n) => n.trackId === 'top')).toBe(true);
    expect(sustain.some((n) => n.trackId === 'top')).toBe(false);
    const ring = (notes: NoteEvent[]) =>
      Math.max(...notes.filter((n) => n.trackId === 'chord').map((n) => n.durationBeat));
    expect(ring(sustain)).toBeGreaterThanOrEqual(ring(ballad));
  });

  it('Relaxed Slow Arp spreads the chord one note at a time', () => {
    const atSameBeat = render('relaxed', 'relaxed.arp')
      .filter((n) => n.trackId === 'chord')
      .reduce<Record<string, number>>((acc, n) => {
        const k = n.timeBeat.toFixed(3);
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
    expect(Object.values(atSameBeat).every((c) => c === 1)).toBe(true);
  });
});
