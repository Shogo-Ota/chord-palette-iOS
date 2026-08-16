import type { PerfChord } from '../PerformanceEngine';
import {
  classifyInterval,
  degreesFromIntervals,
  kindOfDegree,
  wrapPc,
  type HarmonicDegree,
} from '../humanTemplate/degreeRoles';
import type { FullVoicing, FullVoicingNote } from './types';

type DegreeSpec = {
  id: string;
  pc: number;
  interval: number;
  degree: HarmonicDegree;
  isDuplicate: boolean;
};

const MIDI_LO = 0;
const MIDI_HI = 127;

function unique<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function specsForChord(chord: PerfChord): DegreeSpec[] {
  if (!chord.harmony) return [];
  const root = wrapPc(chord.harmony.rootPc);
  const degreeInfo = degreesFromIntervals(root, chord.harmony.chordIntervals);
  const specs = degreeInfo.map((info, index) => {
    const interval =
      chord.harmony!.chordIntervals.find((value) => wrapPc(root + value) === info.pc) ?? 0;
    return {
      id: `${info.degree}:${index}`,
      pc: info.pc,
      interval,
      degree: info.degree,
      isDuplicate: false,
    };
  });

  // A plain triad gets one legal root doubling so the RH body remains a complete
  // keyboard comping gesture. Masks still address it by degree, not MIDI index.
  if (specs.length === 3) {
    specs.push({
      id: 'root:duplicate',
      pc: root,
      interval: 0,
      degree: 'root',
      isDuplicate: true,
    });
  }
  return specs;
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  const out: T[][] = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const tail of permutations(rest)) out.push([item, ...tail]);
  });
  return out;
}

function pitchInstances(pc: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let pitch = lo; pitch <= hi; pitch += 1) {
    if (wrapPc(pitch) === wrapPc(pc)) out.push(pitch);
  }
  return out;
}

function placeUpper(
  order: readonly DegreeSpec[],
  bass: number,
  minimumGap: number,
): FullVoicingNote[] | null {
  const notes: FullVoicingNote[] = [];
  let previous = bass;
  for (const spec of order) {
    const pitch = pitchInstances(spec.pc, previous + minimumGap, MIDI_HI)[0];
    if (pitch == null) return null;
    notes.push({
      pitch,
      pc: spec.pc,
      interval: spec.interval,
      degree: spec.degree,
      handRole: 'RIGHT',
      isBass: false,
      isDuplicate: spec.isDuplicate,
    });
    previous = pitch;
  }
  return notes;
}

function pairMovement(previous: readonly number[], next: readonly number[]): number {
  const a = [...previous].sort((left, right) => left - right);
  const b = [...next].sort((left, right) => left - right);
  const count = Math.min(a.length, b.length);
  let movement = Math.abs(a.length - b.length) * 6;
  for (let index = 0; index < count; index += 1) {
    movement += Math.abs(a[index]! - b[index]!);
  }
  return movement;
}

function softRangeCost(pitch: number, lo: number, hi: number): number {
  if (pitch < lo) return lo - pitch;
  if (pitch > hi) return pitch - hi;
  return 0;
}

function voicingCost(
  notes: readonly FullVoicingNote[],
  previous: FullVoicing | undefined,
  chord: PerfChord,
): number {
  const pitches = notes.map((note) => note.pitch);
  const left = notes.filter((note) => note.handRole === 'LEFT');
  const right = notes.filter((note) => note.handRole === 'RIGHT');
  const bass = left[0]?.pitch ?? pitches[0]!;
  const rightPitches = right.map((note) => note.pitch);
  const rightLow = rightPitches[0] ?? bass;
  const top = rightPitches[rightPitches.length - 1] ?? bass;
  const center = (bass + top) / 2;
  const span = top - bass;
  let cost = Math.abs(bass - 40) * 0.45 + Math.abs(center - 55) * 0.4;
  cost += Math.abs(span - Math.min(32, 18 + pitches.length * 2)) * 0.25;
  cost += softRangeCost(bass, 36, 60) * 2;
  for (const pitch of rightPitches) cost += softRangeCost(pitch, 48, 84) * 2;
  if (chord.harmony?.slashBassPc == null && left[0]?.degree !== 'root') {
    cost += previous ? 7 : 5;
  }

  for (const note of notes) {
    if (kindOfDegree(note.degree) === 'color') {
      if (note.handRole === 'LEFT') cost += 40;
      if (note.pitch < 55) cost += (55 - note.pitch) * 1.8;
    }
  }
  for (let index = 0; index < pitches.length - 1; index += 1) {
    const low = pitches[index]!;
    const interval = pitches[index + 1]! - low;
    if (low < 55 && interval <= 2) cost += 18;
  }

  if (previous) {
    const previousPitches = previous.notes.map((note) => note.pitch);
    const previousLeft = previous.notes.filter((note) => note.handRole === 'LEFT');
    const previousRight = previous.notes.filter((note) => note.handRole === 'RIGHT');
    const previousBass = previousLeft[0]?.pitch ?? previousPitches[0]!;
    const previousRightPitches = previousRight.map((note) => note.pitch);
    const previousRightLow = previousRightPitches[0] ?? previousBass;
    const previousTop = previousRightPitches[previousRightPitches.length - 1] ?? previousBass;
    const previousCenter = (previousBass + previousTop) / 2;
    const previousSpan = previousTop - previousBass;
    const commonMidi = pitches.filter((pitch) => previousPitches.includes(pitch)).length;
    const commonPc = pitches.filter((pitch) =>
      previousPitches.some((candidate) => wrapPc(candidate) === wrapPc(pitch)),
    ).length;
    cost += pairMovement(previousRightPitches, rightPitches) * 1.25;
    cost += Math.abs(bass - previousBass) * 1.15;
    cost += Math.abs(rightLow - previousRightLow) * 1.15;
    cost += Math.abs(top - previousTop) * 2;
    cost += Math.abs(center - previousCenter) * 1.25;
    cost += Math.abs(span - previousSpan) * 0.65;
    cost -= commonMidi * 7;
    cost -= commonPc * 2;
    if (Math.abs(bass - previousBass) >= 12) cost += 18;
    if (Math.abs(top - previousTop) >= 12) cost += 24;
  }
  return cost;
}

function bassSpecs(chord: PerfChord, specs: readonly DegreeSpec[]): DegreeSpec[] {
  if (!chord.harmony) return [];
  const slash = chord.harmony.slashBassPc;
  if (slash != null) {
    const existing = specs.find((spec) => spec.pc === wrapPc(slash) && !spec.isDuplicate);
    return [
      existing ?? {
        id: 'slash:bass',
        pc: wrapPc(slash),
        interval: wrapPc(slash - chord.harmony.rootPc),
        degree: classifyInterval(wrapPc(slash - chord.harmony.rootPc)),
        isDuplicate: false,
      },
    ];
  }
  const core = specs.filter(
    (spec) =>
      !spec.isDuplicate &&
      (spec.degree === 'root' || spec.degree === 'third' || spec.degree === 'fifth'),
  );
  return core.length ? core : specs.slice(0, 1);
}

function candidatesForChord(chord: PerfChord): FullVoicingNote[][] {
  const specs = specsForChord(chord);
  if (!chord.harmony || specs.length === 0) return [];
  const candidates: FullVoicingNote[][] = [];

  for (const bassSpec of bassSpecs(chord, specs)) {
    const bassPitches = pitchInstances(bassSpec.pc, MIDI_LO, MIDI_HI);
    const removeIndex = specs.findIndex((spec) => spec.id === bassSpec.id);
    const upperSpecs =
      removeIndex >= 0
        ? [...specs.slice(0, removeIndex), ...specs.slice(removeIndex + 1)]
        : [...specs];
    for (const bass of bassPitches) {
      const bassNote: FullVoicingNote = {
        pitch: bass,
        pc: bassSpec.pc,
        interval: bassSpec.interval,
        degree: bassSpec.degree,
        handRole: 'LEFT',
        isBass: true,
        isDuplicate: bassSpec.isDuplicate,
      };
      for (const order of permutations(upperSpecs)) {
        for (const gap of [1, 3, 5]) {
          const upper = placeUpper(order, bass, gap);
          if (upper) candidates.push([bassNote, ...upper]);
        }
      }
    }
  }
  return unique(candidates, (candidate) =>
    candidate.map((note) => `${note.pitch}:${note.degree}:${note.isDuplicate ? 1 : 0}`).join('|'),
  );
}

export function buildStableFullVoicings(chords: readonly PerfChord[]): FullVoicing[] {
  const result: FullVoicing[] = [];
  chords.forEach((chord, chordIndex) => {
    const candidates = candidatesForChord(chord);
    if (candidates.length === 0) return;
    const previous = result[result.length - 1];
    candidates.sort((left, right) => {
      const delta = voicingCost(left, previous, chord) - voicingCost(right, previous, chord);
      if (Math.abs(delta) > 1e-9) return delta;
      return left
        .map((note) => note.pitch)
        .join(',')
        .localeCompare(right.map((note) => note.pitch).join(','));
    });
    result.push({ chordIndex, chord, notes: candidates[0]! });
  });
  return result;
}
