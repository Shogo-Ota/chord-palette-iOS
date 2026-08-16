/**
 * Phase 3C — Final MIDI vs sequencer playback semantics.
 * Generation / snapshot construction is not under test; only the playback flatten.
 */
import * as fs from 'fs';
import * as path from 'path';

import { buildFinalMidiSnapshot } from '@/lib/performance/finalMidi/buildFinalMidiSnapshot';
import { buildSessionPerformancePlan } from '@/lib/performance/finalMidi/buildSessionPerformancePlan';
import {
  compareSnapshotToSequencer,
  PHASE3C_CASES,
  PHASE3C_CASE_IDS,
} from '@/lib/playback';

const ROOT = path.resolve(__dirname, '../../../../');
const OUT_DIR = path.join(ROOT, 'LocalAnalysis/teacher_forensic_audit/phase3c');

describe('Phase 3C playback fidelity — sequencer candidate', () => {
  const rows = PHASE3C_CASE_IDS.map((id) => {
    const c = PHASE3C_CASES[id];
    const plan = buildSessionPerformancePlan(c.session, 'free');
    const snapshot = buildFinalMidiSnapshot(plan);
    return compareSnapshotToSequencer(snapshot, c.label);
  });

  it('writes the Phase 3C report', () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const report = {
      engineCandidate: 'sequencer',
      shippingDefaultUnchanged: 'sampled',
      generationUnchanged: true,
      pedalNotBakedIntoDuration: true,
      pitchClamp24to84: false,
      cases: rows,
    };
    fs.writeFileSync(
      path.join(OUT_DIR, 'phase3c_playback_fidelity.json'),
      JSON.stringify(report, null, 2),
    );
    const md = [
      '# Phase 3C — Playback Fidelity (sequencer candidate)',
      '',
      'Generation / FinalMidiSnapshot は未変更。sampled へ CC64 emulation は追加していない。',
      'Production default は `sampled` のまま。Production Release はしない。',
      '',
      ...rows.flatMap((r) => [
        `## ${r.label}`,
        '',
        '| | NoteOn | NoteOff | CC64 |',
        '|---|---:|---:|---:|',
        `| Final MIDI | ${r.finalMidi.noteOn} | ${r.finalMidi.noteOff} | ${r.finalMidi.cc64} |`,
        `| Sequencer Playback | ${r.sequencerPlayback.noteOn} | ${r.sequencerPlayback.noteOff} | ${r.sequencerPlayback.cc64} |`,
        '',
        `- Pitch mismatch count: **${r.pitchMismatchCount}**`,
        `- Onset mismatch count: **${r.onsetMismatchCount}**`,
        `- NoteOff mismatch count: **${r.noteOffMismatchCount}**`,
        `- Velocity mismatch count: **${r.velocityMismatchCount}**`,
        `- CC64 mismatch count: **${r.cc64MismatchCount}**`,
        `- Sampler min/max MIDI note: **${r.samplerMinMidiNote} / ${r.samplerMaxMidiNote}**`,
        `- Notes ≥ 85 (must play as written, not 84): **${r.notesAtOrAbove85}**`,
        `- All match: **${r.allMatch}**`,
        '',
      ]),
    ].join('\n');
    fs.writeFileSync(path.join(OUT_DIR, 'phase3c_playback_fidelity.md'), md);
    expect(fs.existsSync(path.join(OUT_DIR, 'phase3c_playback_fidelity.md'))).toBe(true);
  });

  it('matches Final MIDI 100% on both required cases', () => {
    for (const row of rows) {
      expect(row.finalMidi.noteOn).toBe(row.sequencerPlayback.noteOn);
      expect(row.finalMidi.noteOff).toBe(row.sequencerPlayback.noteOff);
      expect(row.finalMidi.cc64).toBe(row.sequencerPlayback.cc64);
      expect(row.pitchMismatchCount).toBe(0);
      expect(row.onsetMismatchCount).toBe(0);
      expect(row.noteOffMismatchCount).toBe(0);
      expect(row.velocityMismatchCount).toBe(0);
      expect(row.cc64MismatchCount).toBe(0);
      expect(row.allMatch).toBe(true);
    }
  });

  it('sends Variation pitches above 84 to the sampler unchanged', () => {
    const variation = rows.find((r) => r.label.startsWith('Variation'))!;
    expect(variation.notesAtOrAbove85).toBeGreaterThan(0);
    expect(variation.samplerMaxMidiNote).toBeGreaterThanOrEqual(85);
    expect(variation.samplerMaxMidiNote).not.toBe(84);
    expect(variation.pitchMismatchCount).toBe(0);
  });
});
