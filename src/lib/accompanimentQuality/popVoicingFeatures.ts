/**
 * Voice-structure / voice-leading features for one chord transition.
 * Absolute key is not the learning target: degrees, movements, and deltas are.
 */

import { degreeLabel, inversionOf, wrapPc } from './pop909Chords';
import type {
  BassFeatures,
  ColorDegreeLabel,
  ExtensionPlacement,
  PopChordQuality,
  PopChordSpan,
  PopVoiceRole,
  PopVoicing,
  RegisterFeatures,
  RhythmDensityFeatures,
  TopFeatures,
  TransitionFeatures,
  VoiceLeadingFeatures,
  VoicingStructureFeatures,
} from './types';
import { assignVoices } from './voiceAssign';

const COLOR: readonly ColorDegreeLabel[] = ['7', 'b7', '9', 'b9', '#9', '11', '#11', '13', 'b13'];

export function uniqueSorted(pitches: readonly number[]): number[] {
  return [...new Set(pitches)].sort((a, b) => a - b);
}

export function groupAttacks(
  notes: readonly { startBeat: number; pitch: number }[],
  windowBeats = 0.08,
): PopVoicing[] {
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  const groups: PopVoicing[] = [];
  for (const n of sorted) {
    const last = groups[groups.length - 1];
    if (last && n.startBeat - last.onsetBeat <= windowBeats) {
      last.pitches.push(n.pitch);
    } else {
      groups.push({ onsetBeat: n.startBeat, pitches: [n.pitch] });
    }
  }
  return groups.map((g) => ({ onsetBeat: g.onsetBeat, pitches: uniqueSorted(g.pitches) }));
}

export function primaryVoicing(groups: readonly PopVoicing[]): PopVoicing | null {
  if (groups.length === 0) return null;
  return [...groups].sort(
    (a, b) => b.pitches.length - a.pitches.length || a.onsetBeat - b.onsetBeat,
  )[0];
}

export function rolesForPitches(pitches: readonly number[]): PopVoiceRole[] {
  const p = uniqueSorted(pitches);
  return p.map((pitch, i) => {
    if (i === 0) return 'BASS';
    if (i === p.length - 1) return 'TOP';
    const innerCount = p.length - 2;
    if (innerCount <= 1) return 'INNER';
    return i - 1 < innerCount / 2 ? 'INNER' : 'UPPER';
  });
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function spacingProxy(span: number, voiceCount: number): 'close' | 'open' | 'spread' {
  if (voiceCount < 2) return 'close';
  const mean = span / (voiceCount - 1);
  if (mean <= 5) return 'close';
  if (mean <= 9) return 'open';
  return 'spread';
}

export function voiceLeadingFeatures(prev: readonly number[], next: readonly number[]): VoiceLeadingFeatures {
  const a = uniqueSorted(prev);
  const b = uniqueSorted(next);
  const assigned = assignVoices(a, b);
  const moves = assigned.pairs.map((p) => p.cost);
  const common = assigned.pairs.filter((p) => p.from === p.to).length;
  const denom = Math.max(a.length, b.length, 1);
  return {
    voiceCountBefore: a.length,
    voiceCountAfter: b.length,
    commonToneCount: common,
    commonToneRate: common / denom,
    totalVoiceMovementSemitones: assigned.totalCost,
    meanVoiceMovement: moves.length ? assigned.totalCost / moves.length : 0,
    medianVoiceMovement: median(moves),
    maxVoiceMovement: moves.length ? Math.max(...moves) : 0,
    voiceCrossing: assigned.crossingCount,
    retainedVoiceCount: assigned.pairs.length,
  };
}

function structureOf(
  pitches: readonly number[],
  rootPc: number,
  quality: PopChordQuality,
): VoicingStructureFeatures {
  const p = uniqueSorted(pitches);
  const degrees = p.map((midi) => degreeLabel(midi, rootPc));
  const uniqueDeg = [...new Set(degrees)];
  const doubles = degrees.filter((d, i) => degrees.indexOf(d) !== i);
  const expected =
    quality === 'N' || quality === 'other' ? uniqueDeg : ['1', '3', 'b3', '5'].filter((d) => {
      if (d === '3') return uniqueDeg.includes('3');
      if (d === 'b3') return uniqueDeg.includes('b3');
      return true;
    });
  const omissions = ['1', quality === 'minor' || uniqueDeg.includes('b3') ? 'b3' : '3', '5'].filter(
    (d) => !uniqueDeg.includes(d),
  );
  const intervals = p.slice(1).map((midi, i) => midi - p[i]);
  const span = p.length ? p[p.length - 1] - p[0] : 0;
  const bassDeg = p.length ? degreeLabel(p[0], rootPc) : '1';
  return {
    voiceCount: p.length,
    degreeSet: uniqueDeg,
    doublingPattern: doubles.length ? doubles.sort().join('+') : 'none',
    omissionPattern: omissions.length ? omissions.join('+') : 'none',
    spacingProxy: spacingProxy(span, p.length),
    inversion: inversionOf(bassDeg),
    intervalStructure: intervals,
  };
}

function extensionsOf(pitches: readonly number[], rootPc: number): ExtensionPlacement[] {
  const p = uniqueSorted(pitches);
  const roles = rolesForPitches(p);
  const out: ExtensionPlacement[] = [];
  p.forEach((midi, i) => {
    const deg = degreeLabel(midi, rootPc);
    if (!COLOR.includes(deg as ColorDegreeLabel)) return;
    out.push({
      degree: deg as ColorDegreeLabel,
      midi,
      relativePosition: p.length <= 1 ? 0 : i / (p.length - 1),
      role: roles[i],
      isHighest: i === p.length - 1,
      distanceAboveRoot: midi - nearestRootMidi(midi, rootPc),
    });
  });
  return out;
}

function nearestRootMidi(pitch: number, rootPc: number): number {
  const pc = wrapPc(rootPc);
  const base = Math.floor(pitch / 12) * 12 + pc;
  const candidates = [base - 12, base, base + 12];
  return candidates.reduce((best, x) => (Math.abs(x - pitch) < Math.abs(best - pitch) ? x : best));
}

export function extractTransitionFeatures(input: {
  prev: PopVoicing;
  next: PopVoicing;
  prevChord: PopChordSpan;
  nextChord: PopChordSpan;
  attackGroupsInNext: number;
  notesInNextSpan: number;
  spanBeats: number;
}): TransitionFeatures {
  const prevP = uniqueSorted(input.prev.pitches);
  const nextP = uniqueSorted(input.next.pitches);
  const vl = voiceLeadingFeatures(prevP, nextP);
  const bassMidi = nextP[0] ?? 48;
  const topMidi = nextP[nextP.length - 1] ?? 72;
  const prevBass = prevP[0];
  const prevTop = prevP[prevP.length - 1];
  const bassMove = prevBass == null ? null : bassMidi - prevBass;
  const topMove = prevTop == null ? null : topMidi - prevTop;
  const bassDeg = degreeLabel(bassMidi, input.nextChord.rootPc);
  const topDeg = degreeLabel(topMidi, input.nextChord.rootPc);
  const center = nextP.length ? (nextP[0] + nextP[nextP.length - 1]) / 2 : 60;
  const prevCenter = prevP.length ? (prevP[0] + prevP[prevP.length - 1]) / 2 : center;
  const span = nextP.length ? nextP[nextP.length - 1] - nextP[0] : 0;
  const prevSpan = prevP.length ? prevP[prevP.length - 1] - prevP[0] : span;
  const register: RegisterFeatures = {
    lowestPitch: nextP[0] ?? 0,
    highestPitch: nextP[nextP.length - 1] ?? 0,
    registerCenter: center,
    totalSpan: span,
    adjacentVoiceIntervals: nextP.slice(1).map((p, i) => p - nextP[i]),
    registerCenterDelta: center - prevCenter,
    spanDelta: span - prevSpan,
    lowestPitchDelta: prevP.length ? (nextP[0] ?? 0) - prevP[0] : null,
    highestPitchDelta: prevP.length ? (nextP[nextP.length - 1] ?? 0) - prevP[prevP.length - 1] : null,
  };
  const bass: BassFeatures = {
    bassMidi,
    bassDegree: bassDeg,
    bassMovementSemitones: bassMove,
    inversion: inversionOf(bassDeg),
    bassLeapSize: bassMove == null ? null : Math.abs(bassMove),
  };
  const top: TopFeatures = {
    topMidi,
    topDegree: topDeg,
    topMovementSemitones: topMove,
    commonToneRetained: prevTop == null ? null : prevTop === topMidi,
    stepwise: topMove == null ? null : Math.abs(topMove) <= 2,
    contour: topMove == null ? null : topMove > 0 ? 'up' : topMove < 0 ? 'down' : 'same',
  };
  const beatPos = ((input.next.onsetBeat % 4) + 4) % 4;
  const rhythm: RhythmDensityFeatures = {
    attackGroupsInSpan: input.attackGroupsInNext,
    noteCountInPrimary: nextP.length,
    attackDensityPerBeat: input.spanBeats > 0 ? input.attackGroupsInNext / input.spanBeats : 0,
    restRatio: input.notesInNextSpan === 0 ? 1 : 0,
    beatPosition: beatPos,
    syncopated: Math.abs(beatPos - Math.round(beatPos)) > 0.2,
  };
  return {
    sourceQuality: input.prevChord.quality,
    targetQuality: input.nextChord.quality,
    rootMotionSemitones: wrapPc(input.nextChord.rootPc - input.prevChord.rootPc),
    sharedToneCount: vl.commonToneCount,
    voiceLeading: vl,
    bass,
    top,
    register,
    structure: structureOf(nextP, input.nextChord.rootPc, input.nextChord.quality),
    extensions: extensionsOf(nextP, input.nextChord.rootPc),
    rhythm,
  };
}

export function featuresFromVoicingPair(
  prevPitches: readonly number[],
  nextPitches: readonly number[],
  prevChord: Pick<PopChordSpan, 'rootPc' | 'quality' | 'bassPc' | 'symbol'>,
  nextChord: Pick<PopChordSpan, 'rootPc' | 'quality' | 'bassPc' | 'symbol'>,
): TransitionFeatures {
  return extractTransitionFeatures({
    prev: { pitches: [...prevPitches], onsetBeat: 0 },
    next: { pitches: [...nextPitches], onsetBeat: 4 },
    prevChord: {
      startBeat: 0,
      endBeat: 4,
      rootPc: prevChord.rootPc,
      bassPc: prevChord.bassPc,
      quality: prevChord.quality,
      symbol: prevChord.symbol,
    },
    nextChord: {
      startBeat: 4,
      endBeat: 8,
      rootPc: nextChord.rootPc,
      bassPc: nextChord.bassPc,
      quality: nextChord.quality,
      symbol: nextChord.symbol,
    },
    attackGroupsInNext: 1,
    notesInNextSpan: nextPitches.length,
    spanBeats: 4,
  });
}
