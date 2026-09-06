import fs from 'node:fs';
import path from 'node:path';

type Segment = {
  displayName: string;
  startSec: number;
  durationSec: number;
};

const ROOT = path.resolve(__dirname, '../../../..');
const STATE_SOURCE = fs
  .readFileSync(path.join(ROOT, 'modules/chord-video-export/ios/FlowFrameState.swift'), 'utf8')
  .replace(/\r\n/g, '\n');

function progression(count: number): Segment[] {
  return Array.from({ length: count }, (_, index) => ({
    displayName: `Chord ${index + 1}`,
    startSec: index * 2,
    durationSec: 2,
  }));
}

function resolveReference(
  segments: readonly Segment[],
  timeSec: number,
  chordsPerCycle = segments.length,
) {
  const cycle = segments.slice(0, chordsPerCycle);
  const found = segments.findIndex(
    (segment) => timeSec >= segment.startSec && timeSec < segment.startSec + segment.durationSec,
  );
  const globalIndex = found >= 0 ? found : Math.max(0, segments.length - 1);
  const currentIndex = cycle.length > 0 ? globalIndex % cycle.length : 0;
  const current = segments[globalIndex];
  const progress = current
    ? Math.min(1, Math.max(0, (timeSec - current.startSec) / current.durationSec))
    : 0;

  return {
    currentIndex,
    nextIndex: cycle.length > 1 ? (currentIndex + 1) % cycle.length : null,
    previousIndex: cycle.length > 2 ? (currentIndex - 1 + cycle.length) % cycle.length : null,
    followingIndex: cycle.length > 3 ? (currentIndex + 2) % cycle.length : null,
    progress,
  };
}

describe('Flow chord-level frame state', () => {
  it('uses only ExportPlan segments and never note/BPM timing', () => {
    expect(STATE_SOURCE).toContain('currentSegment.startSec');
    expect(STATE_SOURCE).toContain('currentSegment.durationSec');
    expect(STATE_SOURCE).not.toMatch(
      /FlowVisualNote|fallLeadSec|landing|\.bpm\b|beatsPerBar|frameIndex|AVAudio|60(?:\.0)?\s*\//,
    );
  });

  it.each([
    ['onset', 0, 0, 0],
    ['middle', 1, 0, 0.5],
    ['just before boundary', 1.999_999, 0, 0.999_999_5],
    ['exact boundary', 2, 1, 0],
    ['final segment', 7, 3, 0.5],
  ] as const)('resolves %s from exact segment boundaries', (_, time, index, progress) => {
    const state = resolveReference(progression(4), time);
    expect(state.currentIndex).toBe(index);
    expect(state.progress).toBeCloseTo(progress, 6);
  });

  it('wraps final NEXT to the first chord', () => {
    const state = resolveReference(progression(4), 7);
    expect(state.currentIndex).toBe(3);
    expect(state.nextIndex).toBe(0);
    expect(state.previousIndex).toBe(2);
    expect(state.followingIndex).toBe(1);
  });

  it('hides NEXT for a one-chord progression', () => {
    const state = resolveReference(progression(1), 1);
    expect(state.nextIndex).toBeNull();
    expect(state.previousIndex).toBeNull();
    expect(state.followingIndex).toBeNull();
  });

  it.each([4, 8])('preserves NOW/NEXT context for %i chords', (count) => {
    const state = resolveReference(progression(count), 3);
    expect(state.currentIndex).toBe(1);
    expect(state.nextIndex).toBe(2);
    expect(state.previousIndex).toBe(0);
    expect(state.followingIndex).toBe(3);
  });
});
