import type { NaturalRhythmAttackSpec } from './rhythmProfiles';
import { closesRepeatedDropoutPhrase, danceDropoutSupportAttack } from './danceDensityPolicy';

const EPS = 1e-9;
const MIN_TERMINAL_GATE_BEATS = 0.5;

export interface DanceChordWindowInput {
  chordStartBeat: number;
  chordDurationBeats: number;
  beatsPerBar: number;
  hasContiguousNextChord: boolean;
  nextBarIsSplitHalfPair: boolean;
  /** Absolute beat the progression ends on, so phrase-closing bars can be recognised. */
  progressionEndBeat: number;
  attacksForBar: (barInPhrase: number) => readonly NaturalRhythmAttackSpec[];
}

const BASS_SELECTION = { kind: 'VOICE_ROLE', role: 'BASS' } as const;

function selectionIncludesBass(selection: NaturalRhythmAttackSpec['selection']): boolean {
  if (!selection) return false;
  if (selection.kind === 'MASK') return selection.mask === 'FULL';
  if (selection.kind === 'VOICE_ROLE') return selection.role === 'BASS';
  return selection.roles.includes('BASS');
}

/**
 * Place Dance attacks on the physical bar grid rather than restarting an authored
 * four-beat bar for every chord.
 *
 * A two-beat chord in the first half therefore reads the first half of one Dance
 * bar; the following chord reads its second half. The 1.75-beat right-hand push is
 * assigned to the next chord as a 0.25-beat anticipation instead of being clipped.
 * A quiet bass-only boundary then establishes the next chord without replacing that
 * syncopation with a stiff full block on beat 3.
 */
export function danceRhythmForChordWindow(input: DanceChordWindowInput): NaturalRhythmAttackSpec[] {
  const duration = Math.max(0, input.chordDurationBeats);
  const beatsPerBar = Math.max(EPS, input.beatsPerBar);
  if (duration <= EPS) return [];

  const start = Math.max(0, input.chordStartBeat);
  const end = start + duration;
  const firstBar = Math.floor(start / beatsPerBar);
  const lastBar = Math.floor((end - EPS) / beatsPerBar);
  const attacks: NaturalRhythmAttackSpec[] = [];

  for (let bar = firstBar; bar <= lastBar; bar += 1) {
    const barStart = bar * beatsPerBar;
    for (const source of input.attacksForBar(bar)) {
      const absoluteOnset = barStart + source.onsetBeat;
      if (absoluteOnset < start - EPS || absoluteOnset >= end - EPS) continue;

      const fittedGate = Math.min(source.durationBeat, end - absoluteOnset);
      if (
        source.durationBeat >= MIN_TERMINAL_GATE_BEATS - EPS &&
        fittedGate < MIN_TERMINAL_GATE_BEATS - EPS
      ) {
        const isNextChordAnticipation =
          input.hasContiguousNextChord &&
          Math.abs(end - absoluteOnset - 0.25) <= EPS &&
          source.durationBeat >= 0.5 - EPS;
        if (isNextChordAnticipation) {
          attacks.push({
            ...source,
            onsetBeat: Math.max(0, absoluteOnset - start),
            durationBeat: source.durationBeat,
            targetChordOffset: 1,
          });
        }
        continue;
      }

      attacks.push({
        ...source,
        onsetBeat: Math.max(0, absoluteOnset - start),
        durationBeat: fittedGate,
      });
    }
  }

  const beatInBar = start - firstBar * beatsPerBar;
  const occupiesOneFullBar = Math.abs(beatInBar) <= EPS && Math.abs(duration - beatsPerBar) <= EPS;
  const support = occupiesOneFullBar
    ? danceDropoutSupportAttack(input.attacksForBar(firstBar), {
        nextBarIsSplitHalfPair: input.nextBarIsSplitHalfPair,
        closesRepeatedPhrase: closesRepeatedDropoutPhrase({
          bar: firstBar,
          lastBar: Math.max(
            firstBar,
            Math.ceil((Math.max(end, input.progressionEndBeat) - EPS) / beatsPerBar) - 1,
          ),
          attacksForBar: input.attacksForBar,
        }),
      })
    : null;
  if (support) attacks.push(support);

  attacks.sort((left, right) => left.onsetBeat - right.onsetBeat);

  const startsMidBar = beatInBar > EPS;
  const boundaryAttack = attacks.find((attack) => Math.abs(attack.onsetBeat) <= EPS);

  if (startsMidBar && !selectionIncludesBass(boundaryAttack?.selection)) {
    // Keep the measured upper-voice grid intact. Bass alone marks the exact harmony
    // boundary; the anticipated RH has already announced the chord a quarter-beat early.
    const following = attacks[0] ?? input.attacksForBar(firstBar)[0];
    if (following) {
      attacks.unshift({
        ...following,
        onsetBeat: 0,
        durationBeat: Math.min(0.5, duration),
        selection: BASS_SELECTION,
        velocityShape: undefined,
        targetChordOffset: 0,
      });
    }
  }

  return attacks;
}
