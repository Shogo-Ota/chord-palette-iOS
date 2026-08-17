import type { PerfChord } from '../PerformanceEngine';
import { classifyInterval, degreesFromIntervals, wrapPc } from '../humanTemplate/degreeRoles';
import type { FullVoicing, FullVoicingNote } from './types';

/**
 * Adapts the already-resolved Shared Base Voicing carried by `PerfChord` into the
 * degree-tagged shape used by subtractive masks. It never moves or adds a pitch.
 */
export function fullVoicingsFromPerfChords(chords: readonly PerfChord[]): FullVoicing[] {
  const result: FullVoicing[] = [];
  chords.forEach((chord, chordIndex) => {
    if (!chord.harmony) return;
    const rootPc = wrapPc(chord.harmony.rootPc);
    const degrees = degreesFromIntervals(rootPc, chord.harmony.chordIntervals);
    const seenPcs = new Set<number>();

    const noteFor = (
      pitch: number,
      handRole: FullVoicingNote['handRole'],
      isBass: boolean,
    ): FullVoicingNote => {
      const pc = wrapPc(pitch);
      const degreeInfo = degrees.find((candidate) => candidate.pc === pc);
      const interval =
        chord.harmony!.chordIntervals.find((candidate) => wrapPc(rootPc + candidate) === pc) ??
        wrapPc(pc - rootPc);
      const isDuplicate = seenPcs.has(pc);
      seenPcs.add(pc);
      return {
        pitch,
        pc,
        interval,
        degree: degreeInfo?.degree ?? classifyInterval(interval),
        handRole,
        isBass,
        isDuplicate,
      };
    };

    const notes = [
      ...[...chord.bassMidi]
        .sort((left, right) => left - right)
        .map((pitch) => noteFor(pitch, 'LEFT', true)),
      ...[...chord.bodyMidi]
        .sort((left, right) => left - right)
        .map((pitch) => noteFor(pitch, 'RIGHT', false)),
    ];
    result.push({ chordIndex, chord, notes });
  });
  return result;
}
