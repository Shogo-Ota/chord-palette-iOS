import type {
  GrooveControlChange,
  GrooveTimeline,
  TeacherSourceAttack,
  TeacherSourcePedal,
  TeacherTake,
  TimelineAttack,
} from './types';

function clampVelocity(
  note: TeacherSourceAttack['notes'][number],
  attack: TeacherSourceAttack,
): number {
  const raw =
    note.velocity ??
    (note.relativeVelocity != null ? note.relativeVelocity * 127 : undefined) ??
    (attack.relativeVelocity != null ? attack.relativeVelocity * 127 : 84);
  return Math.max(1, Math.min(127, Math.round(raw)));
}

function exactBeatInBar(
  event: { musicalBar: number; beatInMusicalBar: number; absoluteTick?: number },
  take: TeacherTake,
): number {
  if (event.absoluteTick == null) return event.beatInMusicalBar;
  return (
    (event.absoluteTick - take.musicalOriginTick) / take.ppq -
    (event.musicalBar - 1) * take.beatsPerBar
  );
}

function mapAttack(
  source: TeacherSourceAttack,
  take: TeacherTake,
  targetBarIndex: number,
): TimelineAttack {
  const beatInBar = exactBeatInBar(source, take);
  return {
    sourceId: `${take.sourceId}:target${targetBarIndex + 1}:source${source.musicalBar}:attack${source.absoluteTick ?? beatInBar}`,
    barIndex: targetBarIndex,
    beatInBar,
    startBeat: targetBarIndex * take.beatsPerBar + beatInBar,
    attackType: source.attackType,
    notes: source.notes
      .filter((note) => (note.durationBeats ?? 0.5) > 0)
      .map((note, sourceNoteIndex) => ({
        sourceNoteIndex,
        voiceRole: note.voiceRole,
        voicingPosition: note.voicingPosition,
        velocity: clampVelocity(note, source),
        durationBeat: note.durationBeats ?? 0.5,
      })),
  };
}

function sorted(attacks: TimelineAttack[]): TimelineAttack[] {
  return attacks.sort((a, b) => a.startBeat - b.startBeat || a.sourceId.localeCompare(b.sourceId));
}

/** Bars 1–4 copied to bars 5–8. This is the non-varying teacher timeline baseline. */
export function teacherTimelineRepeat(take: TeacherTake): GrooveTimeline {
  const firstPhrase = take.attacks.filter(
    (attack) => attack.musicalBar >= 1 && attack.musicalBar <= 4,
  );
  const attacks = firstPhrase.flatMap((attack) => [
    mapAttack(attack, take, attack.musicalBar - 1),
    mapAttack(attack, take, attack.musicalBar + 3),
  ]);
  return { attacks: sorted(attacks), totalBars: 8, beatsPerBar: take.beatsPerBar };
}

/**
 * Actual variation only. Prefer bars 5–8 from the base take when present.
 * Current shipped takes expose attacks for bars 1–4 only, so an approved real
 * Variation take can provide the second phrase. No random/synthetic events.
 */
export function teacherPhraseVariation(
  take: TeacherTake,
  variationTake: TeacherTake = take,
): GrooveTimeline {
  const firstPhrase = take.attacks
    .filter((attack) => attack.musicalBar >= 1 && attack.musicalBar <= 4)
    .map((attack) => mapAttack(attack, take, attack.musicalBar - 1));
  const ownSecondPhrase = take.attacks.filter(
    (attack) => attack.musicalBar >= 5 && attack.musicalBar <= 8,
  );
  const secondPhrase =
    ownSecondPhrase.length > 0
      ? ownSecondPhrase.map((attack) => mapAttack(attack, take, attack.musicalBar - 1))
      : variationTake.attacks
          .filter((attack) => attack.musicalBar >= 1 && attack.musicalBar <= 4)
          .map((attack) => mapAttack(attack, variationTake, attack.musicalBar + 3));
  const attacks = [...firstPhrase, ...secondPhrase];
  return { attacks: sorted(attacks), totalBars: 8, beatsPerBar: take.beatsPerBar };
}

function pedalEvent(
  source: TeacherSourcePedal,
  take: TeacherTake,
  targetBarIndex: number,
): GrooveControlChange {
  return {
    startBeat: targetBarIndex * take.beatsPerBar + exactBeatInBar(source, take),
    controller: 64,
    value: source.state === 'down' ? Math.max(64, Math.min(127, source.value)) : 0,
    channel: 0,
  };
}

/**
 * Fixed CC64 policy for every candidate: teacher bars 1–4 repeated.
 * Phrase variation changes notes only, never pedal policy.
 */
export function repeatedTeacherPedal(take: TeacherTake): GrooveControlChange[] {
  const firstPhrase = take.pedalEvents.filter(
    (event) => event.musicalBar >= 1 && event.musicalBar <= 4,
  );
  return firstPhrase
    .flatMap((event) => [
      pedalEvent(event, take, event.musicalBar - 1),
      pedalEvent(event, take, event.musicalBar + 3),
    ])
    .filter((event) => event.startBeat >= 0 && event.startBeat < 32)
    .sort((a, b) => a.startBeat - b.startBeat || a.value - b.value);
}
