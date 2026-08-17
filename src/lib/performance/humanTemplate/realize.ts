/**
 * Realize a Human MIDI Template onto user chords.
 *
 * Timing, duration and velocity come from the teacher and are not regenerated.
 * Public Natural (`sharedBase`): Shared Base Voicing + attack-group masks.
 * Legacy templates (`userChord`): historical per-attack user-chord realization.
 * Teacher fidelity (`teacherFidelity`): lossless Identity / Pure Transpose.
 * Teacher `absolutePitch` is never read here.
 */

import { clampVelocity, type NoteEvent } from '../NoteEvent';
import type { PerfChord } from '../PerformanceEngine';
import { resolveAllowed } from '../strictV2';
import { realizeDegreePitch } from './degreePitch';
import { teacherVelocity } from './losslessTone';
import { progressionTransposeDelta, wrapPitchClass } from './pureTranspose';
import type { HumanMidiTemplate } from './types';
import { realizeAtomicNaturalType1 } from '../naturalAtomic/realize';
import { emptyVoiceLeadingState, realizeVoiceStructureAttack } from './voiceStructureRealize';

export type HumanTemplatePitchMode = 'sharedBase' | 'userChord' | 'teacherFidelity';

export interface RealizeHumanTemplateOptions {
  seed: number;
  /** Ignored on the Human Template path — teacher velocity is used as-is. */
  velocityCenter?: number;
  trackId?: NoteEvent['trackId'];
  /**
   * Public Natural passes `sharedBase`. `userChord` remains for hidden legacy
   * templates; `teacherFidelity` is the lossless regression path.
   */
  pitchMode?: HumanTemplatePitchMode;
}

function clampMidi(n: number): number {
  return Math.max(0, Math.min(127, Math.round(n)));
}

function targetLoopRoots(chords: readonly PerfChord[], loopBars: number): number[] | undefined {
  const roots: number[] = [];
  for (let bar = 1; bar <= loopBars; bar++) {
    const chord = chords.find((c, i) => (i % loopBars) + 1 === bar && !!c.harmony);
    if (!chord?.harmony) return undefined;
    roots.push(wrapPitchClass(chord.harmony.rootPc));
  }
  return roots;
}

function globalTransposeDelta(
  template: HumanMidiTemplate,
  chords: readonly PerfChord[],
  loopBars: number,
): number | undefined {
  const source = template.sourceLoopRoots;
  if (!source || source.length !== loopBars) return undefined;
  const target = targetLoopRoots(chords, loopBars);
  if (!target) return undefined;
  return progressionTransposeDelta(source, target);
}

/**
 * Realize template attacks across a progression. Each chord occupies one loop bar
 * (typically 4 beats). Attacks are matched by `musicalBarInLoop` = (chordIndex % loopBars) + 1.
 */
export function realizeHumanTemplate(
  template: HumanMidiTemplate,
  chords: PerfChord[],
  options: RealizeHumanTemplateOptions,
): NoteEvent[] {
  if (chords.length === 0 || template.attacks.length === 0) return [];

  const trackId = options.trackId ?? 'chord';
  const loopBars = template.loopBars;
  const pitchMode = options.pitchMode ?? 'userChord';
  if (pitchMode === 'sharedBase') {
    return realizeAtomicNaturalType1(template, chords, options.seed).notes.map((note) => ({
      ...note,
      trackId,
    }));
  }

  const globalDelta =
    pitchMode === 'teacherFidelity' ? globalTransposeDelta(template, chords, loopBars) : undefined;
  const events: NoteEvent[] = [];
  let leading = emptyVoiceLeadingState();

  chords.forEach((chord, chordIndex) => {
    if (!chord.harmony) return;
    const allowed = resolveAllowed(chord.harmony);
    const barInLoop = (chordIndex % loopBars) + 1;
    const barAttacks = template.attacks.filter((a) => a.musicalBarInLoop === barInLoop);

    for (const attack of barAttacks) {
      const offset = attack.beatInMusicalBar + (attack.timingOffsetBeats ?? 0);
      const absPos = chord.startBeat + offset;
      if (attack.notes.length === 0) continue;

      const sounding = attack.notes.filter((note) => (note.durationBeats ?? 0.5) > 0);
      if (pitchMode === 'teacherFidelity') {
        const pitches = sounding.map((note) =>
          clampMidi(realizeDegreePitch(note, allowed, globalDelta)),
        );
        sounding.forEach((note, i) => {
          events.push({
            timeBeat: absPos,
            durationBeat: note.durationBeats ?? 0.5,
            pitch: pitches[i]!,
            velocity: clampVelocity(teacherVelocity(note)),
            articulation: 'normal',
            rrIndex: 0,
            trackId,
            seed: options.seed,
          });
        });
        continue;
      }

      const realized = realizeVoiceStructureAttack(
        sounding,
        allowed,
        leading,
        chord.harmony.slashBassPc,
      );
      leading = realized.state;
      sounding.forEach((note, i) => {
        const pitch = realized.pitches[i];
        if (pitch == null) return;
        events.push({
          timeBeat: absPos,
          durationBeat: note.durationBeats ?? 0.5,
          pitch: clampMidi(pitch),
          velocity: clampVelocity(teacherVelocity(note)),
          articulation: 'normal',
          rrIndex: 0,
          trackId,
          seed: options.seed,
        });
      });
    }
  });

  events.sort((a, b) => a.timeBeat - b.timeBeat || a.pitch - b.pitch);
  return events;
}
