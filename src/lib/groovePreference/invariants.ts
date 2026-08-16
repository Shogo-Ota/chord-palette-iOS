import type { GrooveCandidate } from './types';

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

export type GrooveInvariantReport = {
  ok: boolean;
  errors: string[];
};

export function validateGrooveCandidateSet(
  candidates: readonly GrooveCandidate[],
): GrooveInvariantReport {
  const errors: string[] = [];
  const byProgression = new Map<string, GrooveCandidate[]>();
  for (const candidate of candidates) {
    const list = byProgression.get(candidate.progressionId) ?? [];
    list.push(candidate);
    byProgression.set(candidate.progressionId, list);
  }

  for (const [progressionId, group] of byProgression) {
    if (group.length !== 5)
      errors.push(`${progressionId}: expected 5 candidates, got ${group.length}`);
    const reference = group[0];
    if (!reference) continue;
    for (const candidate of group) {
      if (candidate.bpm !== 70) errors.push(`${candidate.id}: BPM changed`);
      if (candidate.totalBeats !== 32) errors.push(`${candidate.id}: total beats changed`);
      if (stableJson(candidate.chordSymbols) !== stableJson(reference.chordSymbols)) {
        errors.push(`${candidate.id}: chord progression changed`);
      }
      if (stableJson(candidate.fixedVoicings) !== stableJson(reference.fixedVoicings)) {
        errors.push(`${candidate.id}: fixed voicing changed`);
      }
      if (stableJson(candidate.controlChanges) !== stableJson(reference.controlChanges)) {
        errors.push(`${candidate.id}: CC64 policy changed`);
      }

      const duplicates = new Set<string>();
      for (const note of candidate.notes) {
        const pool = candidate.fixedVoicings[note.barIndex % candidate.fixedVoicings.length];
        if (!pool?.includes(note.pitch)) {
          errors.push(`${candidate.id}: invented pitch ${note.pitch} in bar ${note.barIndex + 1}`);
        }
        if (note.voiceIndex < 0 || note.voiceIndex >= (pool?.length ?? 0)) {
          errors.push(`${candidate.id}: invalid voice index ${note.voiceIndex}`);
        }
        const duplicateKey = `${note.startBeat.toFixed(8)}:${note.pitch}`;
        if (duplicates.has(duplicateKey)) {
          errors.push(`${candidate.id}: simultaneous duplicate ${duplicateKey}`);
        }
        duplicates.add(duplicateKey);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateControlledDifferences(
  candidates: readonly GrooveCandidate[],
): GrooveInvariantReport {
  const errors: string[] = [];
  for (const progressionId of ['A', 'B', 'C'] as const) {
    const group = candidates.filter((candidate) => candidate.progressionId === progressionId);
    const baseline = group.find((candidate) => candidate.type === 'TEACHER_TIMELINE_REPEAT');
    const simplified = group.find((candidate) => candidate.type === 'SIMPLIFIED_DENSITY');
    const broken = group.find((candidate) => candidate.type === 'BROKEN_CONTROL');
    if (!baseline || !simplified || !broken) {
      errors.push(`${progressionId}: required controls missing`);
      continue;
    }

    const baselineByKey = new Map(
      baseline.notes.map((note) => [`${note.sourceAttackId}:${note.pitch}`, note]),
    );
    for (const note of simplified.notes) {
      const source = baselineByKey.get(`${note.sourceAttackId}:${note.pitch}`);
      if (!source) {
        errors.push(`${simplified.id}: surviving note has no baseline source`);
        continue;
      }
      if (Math.abs(source.durationBeat - note.durationBeat) > 1e-9) {
        errors.push(`${simplified.id}: surviving duration was changed`);
      }
    }

    const eventShape = (candidate: GrooveCandidate) =>
      candidate.notes.map((note) => [
        note.startBeat,
        note.durationBeat,
        note.pitch,
        note.barIndex,
        note.voiceIndex,
      ]);
    if (stableJson(eventShape(baseline)) !== stableJson(eventShape(broken))) {
      errors.push(`${broken.id}: onset/pitch/duration shape changed`);
    }
    const baselineVelocities = baseline.notes.map((note) => note.velocity).sort((a, b) => a - b);
    const brokenVelocities = broken.notes.map((note) => note.velocity).sort((a, b) => a - b);
    if (stableJson(baselineVelocities) !== stableJson(brokenVelocities)) {
      errors.push(`${broken.id}: velocity distribution changed`);
    }
  }
  return { ok: errors.length === 0, errors };
}
