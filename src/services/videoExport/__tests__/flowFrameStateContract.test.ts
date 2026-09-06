import fs from 'node:fs';
import path from 'node:path';

type Segment = {
  displayName: string;
  startSec: number;
  durationSec: number;
};

type ReferenceState = {
  currentIndex: number;
  previousIndex: number | null;
  nextIndex: number | null;
  segmentProgress: number;
  handoffProgress: number;
  currentOpacity: number;
  nextOpacity: number;
  currentScale: number;
  nextScale: number;
};

const ROOT = path.resolve(__dirname, '../../../..');
const STATE_SOURCE = fs
  .readFileSync(path.join(ROOT, 'modules/chord-video-export/ios/FlowFrameState.swift'), 'utf8')
  .replace(/\r\n/g, '\n');

function preset(name: string): number {
  const match = STATE_SOURCE.match(new RegExp(`static let ${name}: CGFloat = ([0-9.]+)`));
  if (!match) throw new Error(`Missing Flow preset: ${name}`);
  return Number(match[1]);
}

const HANDOFF_START = preset('handoffStartNormalized');
const CURRENT_OPACITY = preset('currentOpacity');
const BOUNDARY_CURRENT_OPACITY = preset('boundaryCurrentOpacity');
const ADJACENT_OPACITY = preset('adjacentOpacity');
const BOUNDARY_ADJACENT_OPACITY = preset('boundaryAdjacentOpacity');
const CURRENT_SCALE = preset('currentScale');
const BOUNDARY_CURRENT_SCALE = preset('boundaryCurrentScale');
const ADJACENT_SCALE = preset('adjacentScale');
const BOUNDARY_ADJACENT_SCALE = preset('boundaryAdjacentScale');

function smoothstep(value: number): number {
  const x = Math.min(1, Math.max(0, value));
  return x * x * (3 - 2 * x);
}

function resolveReference(
  segments: readonly Segment[],
  timeSec: number,
  chordsPerCycle = segments.length,
): ReferenceState {
  const cycle = segments.slice(0, chordsPerCycle);
  if (segments.length === 0 || cycle.length === 0) {
    return {
      currentIndex: 0,
      previousIndex: null,
      nextIndex: null,
      segmentProgress: 0,
      handoffProgress: 0,
      currentOpacity: 0,
      nextOpacity: 0,
      currentScale: 0,
      nextScale: 0,
    };
  }

  const found = segments.findIndex(
    (segment) => timeSec >= segment.startSec && timeSec < segment.startSec + segment.durationSec,
  );
  const globalIndex = found >= 0 ? found : segments.length - 1;
  const currentIndex = globalIndex % cycle.length;
  const current = segments[globalIndex];
  const segmentProgress = Math.min(
    1,
    Math.max(0, (timeSec - current.startSec) / Math.max(0.000_001, current.durationSec)),
  );
  const motionEnabled = cycle.length > 1;
  const handoffProgress = motionEnabled
    ? smoothstep((segmentProgress - HANDOFF_START) / (1 - HANDOFF_START))
    : 0;
  const previousIndex =
    motionEnabled && cycle.length > 2 ? (currentIndex - 1 + cycle.length) % cycle.length : null;
  const nextIndex = motionEnabled ? (currentIndex + 1) % cycle.length : null;
  const currentOpacity =
    CURRENT_OPACITY + (BOUNDARY_CURRENT_OPACITY - CURRENT_OPACITY) * handoffProgress;
  const nextOpacity =
    nextIndex === null
      ? 0
      : ADJACENT_OPACITY + (BOUNDARY_ADJACENT_OPACITY - ADJACENT_OPACITY) * handoffProgress;
  const currentScale = CURRENT_SCALE + (BOUNDARY_CURRENT_SCALE - CURRENT_SCALE) * handoffProgress;
  const nextScale =
    nextIndex === null
      ? 0
      : ADJACENT_SCALE + (BOUNDARY_ADJACENT_SCALE - ADJACENT_SCALE) * handoffProgress;

  return {
    currentIndex,
    previousIndex,
    nextIndex,
    segmentProgress,
    handoffProgress,
    currentOpacity,
    nextOpacity,
    currentScale,
    nextScale,
  };
}

function progression(count: number): Segment[] {
  const longNames = ['C#m7(♭5)', 'G13(♭9)', 'Fmaj9/A'];
  return Array.from({ length: count }, (_, index) => ({
    displayName: longNames[index] ?? `Chord ${index + 1}`,
    startSec: index * 2,
    durationSec: 2,
  }));
}

describe('Flow frame-state contract', () => {
  it('centralizes the approved handoff target and smoothstep easing', () => {
    expect(HANDOFF_START).toBe(0.7);
    expect(STATE_SOURCE.match(/handoffStartNormalized/g)).toHaveLength(3);
    expect(STATE_SOURCE).toContain('return x * x * (3 - 2 * x)');
    expect(STATE_SOURCE).not.toMatch(/\.bpm\b|beatsPerBar|frameIndex|60(?:\.0)?\s*\//);
  });

  it.each([
    ['onset', 0, 0, 0],
    ['mid', 1, 0, 0.5],
    ['handoff start', 1.4, 0, 0.7],
    ['just before boundary', 1.999_999, 0, 0.999_999_5],
    ['exact boundary', 2, 1, 0],
    ['just after boundary', 2.000_001, 1, 0.000_000_5],
  ] as const)('resolves %s from segment boundaries', (_, time, index, progress) => {
    const state = resolveReference(progression(4), time);
    expect(state.currentIndex).toBe(index);
    expect(state.segmentProgress).toBeCloseTo(progress, 6);
  });

  it('keeps Current strictly more dominant than Next before the boundary', () => {
    for (const progress of [0.7, 0.8, 0.9, 0.99, 0.999_999]) {
      const state = resolveReference(progression(4), progress * 2);
      expect(state.currentOpacity).toBeGreaterThan(state.nextOpacity);
      expect(state.currentScale).toBeGreaterThan(state.nextScale);
      expect(state.currentOpacity * state.currentScale).toBeGreaterThan(
        state.nextOpacity * state.nextScale,
      );
    }
    expect(BOUNDARY_CURRENT_OPACITY).toBeGreaterThan(BOUNDARY_ADJACENT_OPACITY);
    expect(BOUNDARY_CURRENT_SCALE).toBeGreaterThan(BOUNDARY_ADJACENT_SCALE);
  });

  it('wraps final Next to the first chord', () => {
    const state = resolveReference(progression(4), 7);
    expect(state.currentIndex).toBe(3);
    expect(state.previousIndex).toBe(2);
    expect(state.nextIndex).toBe(0);
  });

  it('disables false motion for one chord', () => {
    const state = resolveReference(progression(1), 1.999_999);
    expect(state.previousIndex).toBeNull();
    expect(state.nextIndex).toBeNull();
    expect(state.handoffProgress).toBe(0);
    expect(state.currentOpacity).toBe(CURRENT_OPACITY);
  });

  it('suppresses the duplicate adjacent label for two chords', () => {
    const state = resolveReference(progression(2), 1);
    expect(state.previousIndex).toBeNull();
    expect(state.nextIndex).toBe(1);
  });

  it.each([4, 8])('keeps only previous/current/next state for %i chords', (count) => {
    const state = resolveReference(progression(count), 3);
    expect(state.previousIndex).toBe(0);
    expect(state.currentIndex).toBe(1);
    expect(state.nextIndex).toBe(2);
  });

  it.each(['C#m7(♭5)', 'G13(♭9)', 'Fmaj9/A'])(
    'preserves the long chord name %s unchanged',
    (displayName) => {
      const segments = [{ displayName, startSec: 0, durationSec: 2 }];
      expect(segments[resolveReference(segments, 1).currentIndex]?.displayName).toBe(displayName);
    },
  );
});
