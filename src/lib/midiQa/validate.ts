/**
 * Automated MIDI QA validators. Pattern-agnostic except the Block contract,
 * which is a named accompaniment id — not a hardcoded teacher / type list.
 */

import { parseSmf } from '@/lib/performance/library/ingest/smf';
import { writeSmf } from '@/lib/midiExport';
import type { FinalMidiSnapshot, SessionPerformancePlan } from '@/lib/midiExport';

import { accompanimentNotes, analyzeCase } from './analyze';
import type { QaProgressionId } from './progressions';
import type { CaseAnalysis, CaseVerdict, QaFailure } from './types';

const BAR_HEAD = 1 / 16;
const HARD_LO = 21;
const HARD_HI = 96;
const PREFERRED_LO = 31;
const PREFERRED_HI = 72;

function fail(
  category: QaFailure['category'],
  code: string,
  message: string,
  extra: Partial<QaFailure> = {},
): QaFailure {
  return { category, code, message, ...extra };
}

function isBlock(pattern: string): boolean {
  return pattern === 'block';
}

export function validateStructure(snapshot: FinalMidiSnapshot): QaFailure[] {
  const out: QaFailure[] = [];
  const notes = accompanimentNotes(snapshot);
  for (const n of notes) {
    if (n.durationBeat <= 0) {
      out.push(fail('structure', 'stuck_note', `duration ${n.durationBeat} at beat ${n.startBeat}`, {
        beat: n.startBeat,
        pitch: n.pitch,
      }));
    }
    if (n.pitch < 1 || n.pitch > 127) {
      out.push(fail('structure', 'illegal_midi_pitch', `pitch ${n.pitch}`, { pitch: n.pitch }));
    }
    if (n.velocity < 1 || n.velocity > 127) {
      out.push(fail('structure', 'illegal_velocity', `velocity ${n.velocity} pitch ${n.pitch}`, {
        pitch: n.pitch,
      }));
    }
  }
  for (const cc of snapshot.controlChanges) {
    if (cc.controller !== 64) {
      out.push(fail('structure', 'unexpected_cc', `CC${cc.controller}`));
    }
    if (cc.value < 0 || cc.value > 127) {
      out.push(fail('structure', 'illegal_cc64', `CC64 value ${cc.value}`));
    }
  }
  try {
    const song = parseSmf(writeSmf(snapshot));
    for (const w of song.warnings) {
      out.push(fail('structure', 'smf_warning', w));
    }
    const accomp = notes.length;
    const parsedAccomp = song.notes.filter((n) => n.channel !== 9).length;
    if (parsedAccomp !== accomp) {
      out.push(
        fail(
          'structure',
          'note_on_off_mismatch',
          `SMF accomp notes ${parsedAccomp} != snapshot ${accomp}`,
        ),
      );
    }
  } catch (e) {
    out.push(fail('structure', 'smf_parse', String(e)));
  }
  return out;
}

export function validateHarmonyAndDegree(analysis: CaseAnalysis): QaFailure[] {
  const out: QaFailure[] = [];
  for (const bar of analysis.bars) {
    for (const pitch of bar.illegalPitches) {
      out.push(
        fail(
          'harmony',
          'illegal_chord_tone',
          `${bar.chordLabel}: pitch ${pitch} not in [${bar.allowedPcs.join(',')}]`,
          { beat: bar.startBeat, pitch },
        ),
      );
    }
    for (const pitch of bar.duplicatePitches) {
      out.push(
        fail(
          'harmony',
          'duplicate_simultaneous_pitch',
          `${bar.chordLabel}: duplicate pitch ${pitch}`,
          { beat: bar.startBeat, pitch },
        ),
      );
    }
    if (isBlock(analysis.pattern)) {
      for (const ess of bar.missingEssentials) {
        out.push(
          fail(
            'degree',
            'missing_essential_tone',
            `${bar.chordLabel}: missing ${ess}`,
            { beat: bar.startBeat },
          ),
        );
      }
    }
    if (bar.degreeCounts.other) {
      out.push(
        fail(
          'degree',
          'unclassified_degree',
          `${bar.chordLabel}: ${bar.degreeCounts.other} note(s) with no chord degree`,
          { beat: bar.startBeat },
        ),
      );
    }
  }
  return out;
}

export function validateRhythm(analysis: CaseAnalysis): QaFailure[] {
  const out: QaFailure[] = [];
  if (!isBlock(analysis.pattern)) return out;
  for (const bar of analysis.bars) {
    if (bar.attackGroupCount !== 1) {
      out.push(
        fail(
          'rhythm',
          'attack_group_count',
          `${bar.chordLabel}: attackGroupCountPerBar=${bar.attackGroupCount} (expected 1)`,
          { beat: bar.startBeat },
        ),
      );
    }
    for (const g of bar.attackGroups) {
      if (g.startBeat > bar.startBeat + BAR_HEAD) {
        out.push(
          fail(
            'rhythm',
            'mid_bar_note_on',
            `${bar.chordLabel}: NoteOn at beat ${g.startBeat.toFixed(3)} (bar starts ${bar.startBeat})`,
            { beat: g.startBeat },
          ),
        );
      }
    }
    if (bar.attackGroupCount > 1) {
      out.push(
        fail(
          'rhythm',
          'repeated_attacks',
          `${bar.chordLabel}: ${bar.attackGroupCount} attacks in one bar`,
          { beat: bar.startBeat },
        ),
      );
    }
  }
  return out;
}

export function validateRegister(analysis: CaseAnalysis): QaFailure[] {
  const out: QaFailure[] = [];
  if (analysis.noteCount === 0) {
    out.push(fail('register', 'empty_accompaniment', 'no accompaniment notes'));
    return out;
  }
  if (analysis.pitchMin < HARD_LO || analysis.pitchMax > HARD_HI) {
    out.push(
      fail(
        'register',
        'pitch_range',
        `span ${analysis.pitchMin}–${analysis.pitchMax} outside ${HARD_LO}–${HARD_HI}`,
      ),
    );
  }
  if (analysis.pitchMin < PREFERRED_LO || analysis.pitchMax > PREFERRED_HI) {
    out.push(
      fail(
        'register',
        'register_span',
        `span ${analysis.pitchMin}–${analysis.pitchMax} outside preferred ${PREFERRED_LO}–${PREFERRED_HI}`,
      ),
    );
  }
  return out;
}

export function validateCase(
  caseId: string,
  pattern: CaseAnalysis['pattern'],
  variantId: string,
  progressionId: QaProgressionId,
  snapshot: FinalMidiSnapshot,
  plan: SessionPerformancePlan,
): CaseVerdict {
  const analysis = analyzeCase(caseId, pattern, variantId, progressionId, snapshot, plan);
  analysis.failures = [
    ...validateStructure(snapshot),
    ...validateHarmonyAndDegree(analysis),
    ...validateRhythm(analysis),
    ...validateRegister(analysis),
  ];
  return { analysis, pass: analysis.failures.length === 0 };
}
