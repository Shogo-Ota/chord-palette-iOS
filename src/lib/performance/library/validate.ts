/**
 * Validator for library pattern entries (implementation_v1.01 Phase 12).
 * Returns a list of human-readable problems — empty means the entry is sound.
 * Pure; used by authoring tooling and tests, never on the render path.
 */

import type { LibraryPattern } from './types';

export function validateLibraryPattern(p: LibraryPattern): string[] {
  const problems: string[] = [];

  if (!p.id) problems.push('id is empty');
  if (!p.name) problems.push('name is empty');
  if (!p.license) problems.push('license/provenance is empty');
  if (p.patternLengthBeats <= 0) problems.push('patternLengthBeats must be > 0');
  if (p.timeSignature.beatsPerBar <= 0 || p.timeSignature.beatUnit <= 0) {
    problems.push('timeSignature must be positive');
  }
  if (p.bpmRange.min <= 0 || p.bpmRange.max < p.bpmRange.min) {
    problems.push('bpmRange must be positive and ordered');
  }
  if (p.notes.length === 0) problems.push('pattern has no notes');

  p.notes.forEach((n, i) => {
    if (n.posBeats < 0 || n.posBeats >= p.patternLengthBeats) {
      problems.push(`note ${i}: posBeats ${n.posBeats} outside [0, ${p.patternLengthBeats})`);
    }
    if (!Number.isInteger(n.chordToneIndex) || n.chordToneIndex < 0) {
      problems.push(`note ${i}: chordToneIndex must be a non-negative integer`);
    }
    if (!Number.isInteger(n.octaveOffset) || Math.abs(n.octaveOffset) > 3) {
      problems.push(`note ${i}: octaveOffset must be an integer within ±3`);
    }
    if (!(n.velocityRatio > 0 && n.velocityRatio <= 1)) {
      problems.push(`note ${i}: velocityRatio must be in (0, 1]`);
    }
    if (!(n.durationBeats > 0)) problems.push(`note ${i}: durationBeats must be > 0`);
  });

  if (p.accentMap) {
    const beats = Math.ceil(p.patternLengthBeats);
    if (p.accentMap.length !== beats) {
      problems.push(`accentMap length ${p.accentMap.length} ≠ pattern beats ${beats}`);
    }
    if (p.accentMap.some((a) => a < 0 || a > 1)) problems.push('accentMap values must be 0..1');
  }

  if (p.phraseVariation) {
    const pv = p.phraseVariation;
    if (!Number.isInteger(pv.barInPhrase) || pv.barInPhrase < 0 || pv.barInPhrase > 3) {
      problems.push('phraseVariation.barInPhrase must be an integer 0..3');
    }
    if (!pv.notes.length) problems.push('phraseVariation.notes is empty');
    pv.notes.forEach((n, i) => {
      if (n.posBeats < 0 || n.posBeats >= p.patternLengthBeats) {
        problems.push(`phraseVariation note ${i}: posBeats outside pattern`);
      }
      if (!(n.durationBeats > 0)) {
        problems.push(`phraseVariation note ${i}: durationBeats must be > 0`);
      }
    });
  }

  return problems;
}
