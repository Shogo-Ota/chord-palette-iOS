import { accentFor, chordsDisplay, formatRelativeTime, toSummary } from '@/lib/projectSummary';
import type { ChordDuration, ChordEvent, Project } from '@/types';

function ev(displayName: string, durationBeats: ChordDuration = 4): ChordEvent {
  return {
    id: `e-${displayName}`,
    chordId: displayName,
    displayName,
    degreeLabel: 'I',
    function: 'tonic',
    durationBeats,
    isPro: false,
    rootOffset: 0,
    suffix: '',
  };
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    title: 'Morning Sketch',
    key: 'C',
    tempoBpm: 120,
    timeSignature: '4/4',
    instrumentId: 'piano',
    grooveId: 'pop8',
    accompanimentPattern: 'block',
    chordEvents: [ev('C'), ev('G'), ev('Am'), ev('F')],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('formatRelativeTime', () => {
  const now = 1_000_000_000_000;
  it('labels recent times in Japanese', () => {
    expect(formatRelativeTime(now, now)).toBe('たった今');
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5分前');
    expect(formatRelativeTime(now - 2 * 3_600_000, now)).toBe('2時間前');
    expect(formatRelativeTime(now - 3 * 86_400_000, now)).toBe('3日前');
    expect(formatRelativeTime(now - 2 * 7 * 86_400_000, now)).toBe('2週間前');
  });
});

describe('chordsDisplay', () => {
  it('joins names with a middle dot', () => {
    expect(chordsDisplay(project())).toBe('C · G · Am · F');
  });
  it('truncates past the max', () => {
    const p = project({ chordEvents: [ev('C'), ev('G'), ev('Am'), ev('F'), ev('Em')] });
    expect(chordsDisplay(p)).toBe('C · G · Am · F …');
  });
  it('handles the empty case', () => {
    expect(chordsDisplay(project({ chordEvents: [] }))).toBe('コードなし');
  });
});

describe('toSummary', () => {
  it('derives the list-screen summary', () => {
    const now = 5_000_000;
    const s = toSummary(project({ updatedAt: now - 3_600_000 }), now);
    expect(s.keyLabel).toBe('C Major');
    expect(s.tempoBpm).toBe(120);
    expect(s.bars).toBe(4);
    expect(s.chordsDisplay).toBe('C · G · Am · F');
    expect(s.updatedLabel).toBe('1時間前');
  });
});

describe('accentFor', () => {
  it('is deterministic and returns a hex color', () => {
    expect(accentFor('proj-1')).toBe(accentFor('proj-1'));
    expect(accentFor('proj-1')).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
