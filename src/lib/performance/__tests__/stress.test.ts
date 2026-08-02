/**
 * Stress (implementation_v1.01 Phase 10 「ストレス」).
 *
 * What CAN be exercised in Jest is the generation side: many consecutive renders,
 * rapid rhythm changes, tempo sweeps and long progressions must all complete and
 * keep the MIDI invariants. Each `generatePerformance` call is stateless, which is
 * exactly what "パターン変更時の古いイベントを確実に停止する" relies on — the JS
 * layer replaces the whole plan rather than patching it.
 *
 * What CANNOT be tested here (and why), per the Phase 10 escape hatch:
 * - 実機での連続再生・停止 100 回 / バックグラウンド復帰 / Audio Session 割り込み /
 *   Route change / 音源切り替え — these live in the Swift render callback and
 *   AVAudioSession, which Jest cannot host. Manual procedure: docs/release-plan.md
 *   の実機チェックリスト（30 分以上のループ再生、Siri 割り込み、イヤホン抜き差し、
 *   バックグラウンド往復、音色切り替え）で確認する。Phase 1（診断ログ）で
 *   時系列の自動記録を足し、この手動確認を裏付ける。
 */

import { ACCOMPANIMENT_IDS } from '@/data/labels';
import { EVAL_PROGRESSIONS } from '@/lib/performance/analysis/fixtures';
import type { NoteEvent } from '@/lib/performance/NoteEvent';
import { generatePerformance, type PerfChord } from '@/lib/performance/PerformanceEngine';
import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import { remeterChords } from '@/lib/performance/meter';
import { beatsPerBarFor } from '@/lib/performance/rhythms';
import type { ChordEvent } from '@/types';

const PROG = EVAL_PROGRESSIONS[0]; // A: C – G – Am – F

/** Remetered chords per meter, so the loop below doesn't re-run voice leading. */
function chordsByMeter(events: ChordEvent[]): Map<number, PerfChord[]> {
  const authored = progressionToPerfChords(events, 'C');
  const byMeter = new Map<number, PerfChord[]>();
  for (const pattern of ACCOMPANIMENT_IDS) {
    const bpb = beatsPerBarFor(pattern);
    if (!byMeter.has(bpb)) byMeter.set(bpb, remeterChords(authored, bpb));
  }
  return byMeter;
}

function assertSane(notes: NoteEvent[], endBeat: number): void {
  expect(notes.length).toBeGreaterThan(0);
  let last = -Infinity;
  for (const n of notes) {
    expect(n.timeBeat).toBeGreaterThanOrEqual(0);
    expect(n.timeBeat).toBeLessThan(endBeat);
    expect(n.durationBeat).toBeGreaterThan(0);
    expect(n.velocity).toBeGreaterThanOrEqual(1);
    expect(n.velocity).toBeLessThanOrEqual(127);
    // The engine's contract: events arrive sorted by time.
    expect(n.timeBeat).toBeGreaterThanOrEqual(last - 1e-9);
    last = n.timeBeat;
  }
}

function endBeatOf(chords: PerfChord[]): number {
  return chords.reduce((max, c) => Math.max(max, c.startBeat + c.durationBeats), 0);
}

describe('100 consecutive renders with changing rhythm, seed and tempo', () => {
  it('all complete and stay within the invariants', () => {
    const byMeter = chordsByMeter(PROG.chords);
    for (let i = 0; i < 100; i++) {
      const pattern = ACCOMPANIMENT_IDS[i % ACCOMPANIMENT_IDS.length];
      const chords = byMeter.get(beatsPerBarFor(pattern))!;
      const notes = generatePerformance(
        { chords, bpm: 60 + ((i * 7) % 160), seed: i },
        { styleId: pattern, drums: true },
      );
      assertSane(notes, endBeatOf(chords));
    }
  });
});

describe('tempo sweep', () => {
  it('renders Natural cleanly from 40 to 240 BPM', () => {
    const chords = remeterChords(progressionToPerfChords(PROG.chords, 'C'), 4);
    for (let bpm = 40; bpm <= 240; bpm += 10) {
      assertSane(
        generatePerformance({ chords, bpm, seed: 5 }, { styleId: 'natural', drums: true }),
        endBeatOf(chords),
      );
    }
  });
});

describe('long progression', () => {
  it('renders 64 bars (progression A × 16) without breaking order or bounds', () => {
    const repeated: ChordEvent[] = Array.from({ length: 16 }, (_, rep) =>
      PROG.chords.map((c) => ({ ...c, id: `${c.id}-rep${rep}` })),
    ).flat();
    const chords = remeterChords(progressionToPerfChords(repeated, 'C'), 4);
    expect(endBeatOf(chords)).toBe(64 * 4);
    const notes = generatePerformance(
      { chords, bpm: 120, seed: 11 },
      { styleId: 'natural', drums: true },
    );
    assertSane(notes, endBeatOf(chords));
    // Sanity on scale: 64 bars of a real feel should produce hundreds of events.
    expect(notes.length).toBeGreaterThan(500);
  });
});
