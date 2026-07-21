/**
 * Chord-floor guard (design §3-2 safety net). The Variation rules — chiefly
 * `bassOnly`, which drops a whole bar's comp for a "breather" — can leave an
 * interior bar with NO chord strikes at all. Because the performance seed is
 * deterministic, that bar then loses its harmony on EVERY loop iteration, which
 * on a short looping progression reads as "that chord never plays" rather than a
 * musical breath (user-reported: an Em bar sounding only its bass).
 *
 * This pass runs LAST, after every rule, and guarantees each bar keeps at least
 * its protected head (beat 1) chord articulation: for any bar the variation left
 * chord-less, it restores that bar's earliest ORIGINAL chord strike (preferring
 * the bar head, step 0). The bass-only breather feel is preserved (the rest of
 * the bar stays open); only the fully-missing harmony is prevented. Pure and
 * deterministic — it re-inserts a strike that already existed in the grid, so no
 * new randomness or pitches are introduced.
 */

import type { Strike, StrikesByTrack } from '../strike';

/**
 * Ensure no bar is left without a chord strike. `original` is the pre-variation
 * grid (untouched by the rules); `out` is the varied map to repair in place.
 */
export function ensureChordFloor(original: StrikesByTrack, out: StrikesByTrack): void {
  const originalChord = original.chord;
  const outChord = out.chord;
  if (!originalChord || originalChord.length === 0 || !outChord) return;

  const barsWithChord = new Set(outChord.map((s) => s.bar));

  // The strike to restore per bar: the bar head (step 0) when present, else the
  // earliest strike that bar carried in the original grid.
  const headByBar = new Map<number, Strike>();
  for (const s of originalChord) {
    const existing = headByBar.get(s.bar);
    if (!existing || s.step < existing.step) headByBar.set(s.bar, s);
  }

  const restored: Strike[] = [];
  for (const [bar, head] of headByBar) {
    if (barsWithChord.has(bar)) continue;
    restored.push({ ...head, pitches: [...head.pitches] });
  }

  if (restored.length > 0) out.chord = [...outChord, ...restored];
}
