/**
 * Phase 0: inspect real POP909 / POP909-CL files. No guessing — counts and
 * track names come from the bytes and the official READMEs.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename } from 'node:path';

import {
  listClMidiFiles,
  originalMidiPath,
  originalSongDir,
  POP909_CL_ROOT,
  POP909_ORIG_ROOT,
  songIdFromName,
} from './datasetPaths';
import { notesOnTrack, parseSmfDetailed } from '@/lib/accompanimentQuality/smfDetailed';

export type TrackSnapshot = {
  index: number;
  name: string;
  noteCount: number;
  pitchMin: number | null;
  pitchMax: number | null;
  uniqueStarts: number;
};

export type FileSnapshot = {
  id: string;
  path: string;
  format: number;
  ppq: number;
  trackCount: number;
  tracks: TrackSnapshot[];
  tempoCount: number;
  firstTempoBpm: number | null;
  timeSignatures: Array<{ tick: number; numerator: number; denominator: number }>;
  keySignatures: Array<{ tick: number; sharps: number; minor: number }>;
};

function trackSnapshot(
  song: ReturnType<typeof parseSmfDetailed>,
  index: number,
): TrackSnapshot {
  const notes = notesOnTrack(song, index);
  const starts = new Set(notes.map((n) => n.tick));
  return {
    index,
    name: song.trackNames[index] ?? '',
    noteCount: notes.length,
    pitchMin: notes.length ? Math.min(...notes.map((n) => n.pitch)) : null,
    pitchMax: notes.length ? Math.max(...notes.map((n) => n.pitch)) : null,
    uniqueStarts: starts.size,
  };
}

export function inspectMidiFile(path: string): FileSnapshot {
  const song = parseSmfDetailed(readFileSync(path));
  const firstTempo = song.tempos[0];
  return {
    id: songIdFromName(basename(path)),
    path,
    format: song.format,
    ppq: song.ppq,
    trackCount: song.trackCount,
    tracks: Array.from({ length: song.trackCount }, (_, i) => trackSnapshot(song, i)),
    tempoCount: song.tempos.length,
    firstTempoBpm: firstTempo ? Math.round(60_000_000 / firstTempo.usPerQuarter) : null,
    timeSignatures: song.timeSignatures,
    keySignatures: song.keySignatures,
  };
}

export function inspectCorpus(limit = 12): {
  origSongCount: number;
  clMidiCount: number;
  origSamples: FileSnapshot[];
  clSamples: FileSnapshot[];
  origHasPianoName: number;
  origMissing: string[];
} {
  const origIds = existsSync(POP909_ORIG_ROOT)
    ? readdirSync(POP909_ORIG_ROOT).filter((d) => /^\d{3}$/.test(d))
    : [];
  const clFiles = listClMidiFiles();
  const sampleIds = origIds.slice(0, limit);
  const origSamples: FileSnapshot[] = [];
  const origMissing: string[] = [];
  for (const id of sampleIds) {
    const p = originalMidiPath(id);
    if (!existsSync(p)) {
      origMissing.push(id);
      continue;
    }
    origSamples.push(inspectMidiFile(p));
  }
  const clSamples = clFiles.slice(0, limit).map(inspectMidiFile);
  let origHasPianoName = 0;
  for (const id of origIds) {
    const p = originalMidiPath(id);
    if (!existsSync(p)) continue;
    const snap = inspectMidiFile(p);
    if (snap.tracks.some((t) => /piano/i.test(t.name))) origHasPianoName += 1;
  }
  return {
    origSongCount: origIds.length,
    clMidiCount: clFiles.length,
    origSamples,
    clSamples,
    origHasPianoName,
    origMissing,
  };
}

export function renderInspectionMarkdown(report: ReturnType<typeof inspectCorpus>): string {
  const lines: string[] = [
    '# POP909 / POP909-CL dataset inspection',
    '',
    `Date: 2026-08-15`,
    '',
    'Guessing is not used. Counts and track names come from the files on disk',
    'and the official READMEs.',
    '',
    '## Layout',
    '',
    `- Original POP909 root: \`${POP909_ORIG_ROOT}\``,
    `- POP909-CL processed root: \`${POP909_CL_ROOT}\``,
    `- Original song folders: **${report.origSongCount}**`,
    `- POP909-CL processed MIDI: **${report.clMidiCount}**`,
    '- Note: one CL file is named `043 .mid` (space before extension). The lister accepts that.',
    `- Original songs whose MIDI has a track name matching /piano/i: **${report.origHasPianoName}**`,
    '',
    '## Official track meaning (README, not inferred from pitch)',
    '',
    '### Original POP909 (`music-x-lab/POP909-Dataset`)',
    '',
    '- `index.mid` has three arrangement tracks:',
    '- **MELODY** — main melody',
    '- **BRIDGE** — sub-melody',
    '- **PIANO** — piano accompaniment (this is the voicing source)',
    '- `chord_midi.txt` — algorithmic chord labels (start/end seconds, symbol)',
    '- `beat_midi.txt` — beat times',
    '- `key_audio.txt` — key from audio (algorithmic)',
    '',
    '### POP909-CL (`AndyWeasley2004/POP909-CL-Dataset` README)',
    '',
    '- Recommended folder: `POP909_processed/`',
    '- Track 1 (channel 0): musical score (melody + accompaniment + rhythm **combined**)',
    '- Track 2 (channel 1): human-corrected chord symbols as stacked notes',
    '- Chord decode (their `process_pop909.py`): last instrument, notes grouped by onset,',
    '  pitch-class set → quality, lowest pitch → bass',
    '',
    '## Piano accompaniment track we use',
    '',
    '**Primary:** original POP909 track whose name is `PIANO` (README).',
    '**Harmony source of truth for this prior:** POP909-CL last note-bearing track',
    '(human-corrected chord notes), aligned by song id `001`…`909`.',
    '',
    'We do **not** use the CL combined score track as piano accompaniment.',
    'That track mixes melody and accompaniment; using it would contaminate Top Voice.',
    '',
    '## Sample — original',
    '',
  ];
  for (const s of report.origSamples) {
    lines.push(`### ${s.id}  ppq=${s.ppq}  tempo≈${s.firstTempoBpm}  tracks=${s.trackCount}`);
    for (const t of s.tracks) {
      lines.push(
        `- track ${t.index} name="${t.name}" notes=${t.noteCount} range=${t.pitchMin}-${t.pitchMax} onsets=${t.uniqueStarts}`,
      );
    }
    lines.push('');
  }
  lines.push('## Sample — POP909-CL processed', '');
  for (const s of report.clSamples) {
    lines.push(`### ${s.id}  ppq=${s.ppq}  tempo≈${s.firstTempoBpm}  tracks=${s.trackCount}`);
    for (const t of s.tracks) {
      lines.push(
        `- track ${t.index} name="${t.name}" notes=${t.noteCount} range=${t.pitchMin}-${t.pitchMax} onsets=${t.uniqueStarts}`,
      );
    }
    if (s.keySignatures.length) {
      lines.push(`- keySignatures: ${JSON.stringify(s.keySignatures.slice(0, 4))}`);
    }
    if (s.timeSignatures.length) {
      lines.push(`- timeSignatures: ${JSON.stringify(s.timeSignatures.slice(0, 4))}`);
    }
    lines.push('');
  }
  if (report.origMissing.length) {
    lines.push('## Missing original MIDI', '', report.origMissing.join(', '), '');
  }
  return lines.join('\n');
}

export function inspectOneOriginal(id: string): {
  dirFiles: string[];
  midi: FileSnapshot | null;
} {
  const dir = originalSongDir(id);
  return {
    dirFiles: existsSync(dir) ? readdirSync(dir) : [],
    midi: existsSync(originalMidiPath(id)) ? inspectMidiFile(originalMidiPath(id)) : null,
  };
}
