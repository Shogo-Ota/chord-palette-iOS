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
  followingIndex: number | null;
  segmentProgress: number;
  arrivalProgress: number;
  handoffProgress: number;
  currentOpacity: number;
  nextOpacity: number;
  currentScale: number;
  nextScale: number;
  currentX: number;
  nextX: number;
  pathProgress: number;
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
const ARRIVAL_END = preset('arrivalEndNormalized');
const STABLE_CURRENT_OPACITY = preset('stableCurrentOpacity');
const BOUNDARY_CURRENT_OPACITY = preset('boundaryCurrentOpacity');
const STABLE_NEXT_OPACITY = preset('stableNextOpacity');
const BOUNDARY_NEXT_OPACITY = preset('boundaryNextOpacity');
const STABLE_CURRENT_SCALE = preset('stableCurrentScale');
const BOUNDARY_CURRENT_SCALE = preset('boundaryCurrentScale');
const ARRIVAL_NEXT_SCALE = preset('arrivalNextScale');
const STABLE_NEXT_SCALE = preset('stableNextScale');
const BOUNDARY_NEXT_SCALE = preset('boundaryNextScale');
const STABLE_CURRENT_X = preset('stableCurrentX');
const BOUNDARY_CURRENT_X = preset('boundaryCurrentX');
const ARRIVAL_NEXT_X = preset('arrivalNextX');
const STABLE_NEXT_X = preset('stableNextX');
const BOUNDARY_NEXT_X = preset('boundaryNextX');

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * clamp(progress);
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
      followingIndex: null,
      segmentProgress: 0,
      arrivalProgress: 0,
      handoffProgress: 0,
      currentOpacity: 0,
      nextOpacity: 0,
      currentScale: STABLE_CURRENT_SCALE,
      nextScale: ARRIVAL_NEXT_SCALE,
      currentX: 0.5,
      nextX: 0.5,
      pathProgress: 0,
    };
  }

  const found = segments.findIndex(
    (segment) => timeSec >= segment.startSec && timeSec < segment.startSec + segment.durationSec,
  );
  const globalIndex = found >= 0 ? found : segments.length - 1;
  const currentIndex = globalIndex % cycle.length;
  const current = segments[globalIndex];
  const segmentProgress = clamp(
    (timeSec - current.startSec) / Math.max(0.000_001, current.durationSec),
  );
  const motionEnabled = cycle.length > 1;
  const arrivalProgress = motionEnabled ? smoothstep(segmentProgress / ARRIVAL_END) : 1;
  const handoffProgress = motionEnabled
    ? smoothstep((segmentProgress - HANDOFF_START) / (1 - HANDOFF_START))
    : 0;
  const previousIndex =
    motionEnabled && cycle.length > 2 ? (currentIndex - 1 + cycle.length) % cycle.length : null;
  const nextIndex = motionEnabled ? (currentIndex + 1) % cycle.length : null;
  const followingIndex = cycle.length > 3 ? (currentIndex + 2) % cycle.length : null;

  const arrivedCurrentOpacity = mix(
    BOUNDARY_CURRENT_OPACITY,
    STABLE_CURRENT_OPACITY,
    arrivalProgress,
  );
  const currentOpacity = mix(arrivedCurrentOpacity, BOUNDARY_CURRENT_OPACITY, handoffProgress);
  const introducedNextOpacity = mix(0, STABLE_NEXT_OPACITY, arrivalProgress);
  const nextOpacity =
    nextIndex === null ? 0 : mix(introducedNextOpacity, BOUNDARY_NEXT_OPACITY, handoffProgress);

  const arrivedCurrentScale = mix(BOUNDARY_CURRENT_SCALE, STABLE_CURRENT_SCALE, arrivalProgress);
  const currentScale = mix(arrivedCurrentScale, BOUNDARY_CURRENT_SCALE, handoffProgress);
  const introducedNextScale = mix(ARRIVAL_NEXT_SCALE, STABLE_NEXT_SCALE, arrivalProgress);
  const nextScale =
    nextIndex === null
      ? ARRIVAL_NEXT_SCALE
      : mix(introducedNextScale, BOUNDARY_NEXT_SCALE, handoffProgress);

  const arrivedCurrentX = mix(BOUNDARY_NEXT_X, STABLE_CURRENT_X, arrivalProgress);
  const currentX = motionEnabled ? mix(arrivedCurrentX, BOUNDARY_CURRENT_X, handoffProgress) : 0.5;
  const introducedNextX = mix(ARRIVAL_NEXT_X, STABLE_NEXT_X, arrivalProgress);
  const nextX = nextIndex === null ? 0.5 : mix(introducedNextX, BOUNDARY_NEXT_X, handoffProgress);

  return {
    currentIndex,
    previousIndex,
    nextIndex,
    followingIndex,
    segmentProgress,
    arrivalProgress,
    handoffProgress,
    currentOpacity,
    nextOpacity,
    currentScale,
    nextScale,
    currentX,
    nextX,
    pathProgress: motionEnabled ? smoothstep(segmentProgress) : 0,
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

describe('Flow V4.1 frame-state contract', () => {
  it('centralizes arrival, handoff and smoothstep targets', () => {
    expect(ARRIVAL_END).toBe(0.1);
    expect(HANDOFF_START).toBe(0.7);
    expect(STATE_SOURCE.match(/arrivalEndNormalized/g)).toHaveLength(2);
    expect(STATE_SOURCE.match(/handoffStartNormalized/g)).toHaveLength(3);
    expect(STATE_SOURCE).toContain('return x * x * (3 - 2 * x)');
    expect(STATE_SOURCE).not.toMatch(/\.bpm\b|beatsPerBar|frameIndex|60(?:\.0)?\s*\//);
  });

  it.each([
    ['onset', 0, 0, 0],
    ['arrival end', 0.2, 0, 0.1],
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

  it('uses the stable composition between arrival and handoff', () => {
    const state = resolveReference(progression(4), 1);

    expect(state.currentOpacity).toBe(STABLE_CURRENT_OPACITY);
    expect(state.nextOpacity).toBe(STABLE_NEXT_OPACITY);
    expect(state.currentScale).toBe(STABLE_CURRENT_SCALE);
    expect(state.nextScale).toBe(STABLE_NEXT_SCALE);
    expect(state.currentX).toBe(STABLE_CURRENT_X);
    expect(state.nextX).toBe(STABLE_NEXT_X);
  });

  it('keeps NOW strictly more dominant than NEXT before every boundary', () => {
    for (const progress of [0, 0.05, 0.1, 0.5, 0.7, 0.8, 0.9, 0.99, 0.999_999]) {
      const state = resolveReference(progression(4), progress * 2);
      expect(state.currentOpacity).toBeGreaterThan(state.nextOpacity);
      expect(state.currentScale).toBeGreaterThan(state.nextScale);
      expect(state.currentOpacity * state.currentScale * state.currentScale).toBeGreaterThan(
        state.nextOpacity * state.nextScale * state.nextScale,
      );
    }
    expect(BOUNDARY_CURRENT_OPACITY).toBeGreaterThan(BOUNDARY_NEXT_OPACITY);
    expect(BOUNDARY_CURRENT_SCALE).toBeGreaterThan(BOUNDARY_NEXT_SCALE);
  });

  it('lands outgoing NEXT at the next onset NOW position', () => {
    const before = resolveReference(progression(4), 1.999_999);
    const boundary = resolveReference(progression(4), 2);

    expect(before.nextX).toBeCloseTo(BOUNDARY_NEXT_X, 5);
    expect(boundary.currentX).toBe(BOUNDARY_NEXT_X);
    expect(before.nextX).toBeCloseTo(boundary.currentX, 5);
  });

  it('moves the path head monotonically from NOW to NEXT', () => {
    const samples = [0, 0.2, 0.5, 0.7, 0.9, 0.999].map(
      (progress) => resolveReference(progression(4), progress * 2).pathProgress,
    );

    expect(samples).toEqual([...samples].sort((left, right) => left - right));
    expect(samples[0]).toBe(0);
    expect(samples.at(-1)).toBeGreaterThan(0.99);
  });

  it('wraps final NEXT and following context to the first chords', () => {
    const state = resolveReference(progression(4), 7);
    expect(state.currentIndex).toBe(3);
    expect(state.previousIndex).toBe(2);
    expect(state.nextIndex).toBe(0);
    expect(state.followingIndex).toBe(1);
  });

  it('disables false motion for one chord', () => {
    const state = resolveReference(progression(1), 1.999_999);
    expect(state.previousIndex).toBeNull();
    expect(state.nextIndex).toBeNull();
    expect(state.followingIndex).toBeNull();
    expect(state.handoffProgress).toBe(0);
    expect(state.pathProgress).toBe(0);
    expect(state.currentX).toBe(0.5);
  });

  it('suppresses duplicate context for two chords', () => {
    const state = resolveReference(progression(2), 1);
    expect(state.previousIndex).toBeNull();
    expect(state.nextIndex).toBe(1);
    expect(state.followingIndex).toBeNull();
  });

  it.each([4, 8])('resolves previous/NOW/NEXT/following for %i chords', (count) => {
    const state = resolveReference(progression(count), 3);
    expect(state.previousIndex).toBe(0);
    expect(state.currentIndex).toBe(1);
    expect(state.nextIndex).toBe(2);
    expect(state.followingIndex).toBe(3);
  });

  it.each(['C#m7(♭5)', 'G13(♭9)', 'Fmaj9/A'])(
    'preserves the long chord name %s unchanged',
    (displayName) => {
      const segments = [{ displayName, startSec: 0, durationSec: 2 }];
      expect(segments[resolveReference(segments, 1).currentIndex]?.displayName).toBe(displayName);
    },
  );
});
