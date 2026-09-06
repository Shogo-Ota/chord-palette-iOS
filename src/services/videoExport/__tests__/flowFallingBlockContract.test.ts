import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const IOS = path.join(ROOT, 'modules/chord-video-export/ios');
const STATE = fs
  .readFileSync(path.join(IOS, 'FlowFallingBlockState.swift'), 'utf8')
  .replace(/\r\n/g, '\n');

function numericPreset(name: string): number {
  const match = STATE.match(new RegExp(`static let ${name}(?:: CGFloat)? = ([0-9.]+)`));
  if (!match) throw new Error(`Missing Flow performance-motion preset: ${name}`);
  return Number(match[1]);
}

const FALL_LEAD = numericPreset('fallLeadSec');
const MIN_HEIGHT_RATIO = numericPreset('minBlockHeightRatio');
const MAX_HEIGHT_RATIO = numericPreset('maxBlockHeightRatio');
const ATTACK = numericPreset('landingAttackSec');
const FADE = numericPreset('landingFadeSec');

type Event = {
  startSec: number;
  durationSec: number;
  velocity: number;
};

function resolveBlock(event: Event, frameTimeSec: number) {
  const frameHeight = 1920;
  const fallTopY = frameHeight * 0.43;
  const keyboardTopY = frameHeight * 0.73;
  const travelHeight = keyboardTopY - fallTopY;
  const pixelsPerSecond = travelHeight / FALL_LEAD;
  const blockBottomY = keyboardTopY - (event.startSec - frameTimeSec) * pixelsPerSecond;
  const height = Math.min(
    frameHeight * MAX_HEIGHT_RATIO,
    Math.max(frameHeight * MIN_HEIGHT_RATIO, event.durationSec * pixelsPerSecond),
  );
  const visibleTop = Math.max(fallTopY, blockBottomY - height);
  const visibleBottom = Math.min(keyboardTopY, blockBottomY);
  if (visibleBottom <= visibleTop) return null;
  return {
    top: visibleTop,
    bottom: visibleBottom,
    opacity: 0.9 + ((Math.min(127, Math.max(1, event.velocity)) - 1) / 126) * 0.08,
  };
}

function landingIntensity(event: Event, frameTimeSec: number): number {
  const age = frameTimeSec - event.startSec;
  if (age < 0) return 0;
  const duration = Math.max(0, event.durationSec);
  const attackEnd = Math.min(ATTACK, duration);
  if (attackEnd > 0 && age <= attackEnd + 1e-9) return 1 - (0.45 * age) / attackEnd;
  if (age <= duration) {
    return Math.max(0.22, 0.55 * (1 - age / duration));
  }
  const fadeAge = age - duration;
  if (fadeAge > FADE) return 0;
  return 0.22 * (1 - fadeAge / FADE);
}

describe('Flow falling-block movement contract', () => {
  const event = { startSec: 2, durationSec: 0.5, velocity: 96 };
  const keyboardTop = 1920 * 0.73;

  it('uses the approved lead, duration clamp and subtle velocity policy', () => {
    expect(FALL_LEAD).toBe(1.25);
    expect(MIN_HEIGHT_RATIO).toBe(0.018);
    expect(MAX_HEIGHT_RATIO).toBe(0.1);
    expect(STATE).toContain('event.startSec - frameTimeSec');
    expect(STATE).toContain('event.durationSec');
    expect(STATE).not.toMatch(/velocity.*(?:width|height)|random|particle|trail|score|combo/i);
  });

  it.each([
    ['before note appears', 0.74, false],
    ['falling', 1.375, true],
    ['just before landing', 2 - 1 / 30, true],
    ['landing', 2, true],
    ['post landing', 2.1, true],
  ] as const)('%s is a deterministic movement Golden state', (_, timeSec, visible) => {
    expect(resolveBlock(event, timeSec) !== null).toBe(visible);
  });

  it('lands the block bottom exactly at note.startSec', () => {
    expect(resolveBlock(event, event.startSec)?.bottom).toBe(keyboardTop);
    expect(resolveBlock(event, event.startSec - 1 / 30)?.bottom).toBeLessThan(keyboardTop);
  });

  it('changes only opacity when velocity changes', () => {
    const quiet = resolveBlock({ ...event, velocity: 1 }, 1.5);
    const loud = resolveBlock({ ...event, velocity: 127 }, 1.5);
    expect(quiet?.top).toBe(loud?.top);
    expect(quiet?.bottom).toBe(loud?.bottom);
    expect((loud?.opacity ?? 0) - (quiet?.opacity ?? 0)).toBeCloseTo(0.08);
  });

  it('uses attack glow, soft sustain and note-off fade', () => {
    expect(landingIntensity(event, 1.999)).toBe(0);
    expect(landingIntensity(event, 2)).toBe(1);
    expect(landingIntensity(event, 2.08)).toBeCloseTo(0.55);
    expect(landingIntensity(event, 2.3)).toBeGreaterThanOrEqual(0.22);
    expect(landingIntensity(event, 2.5 + FADE + 0.001)).toBe(0);
  });
});
