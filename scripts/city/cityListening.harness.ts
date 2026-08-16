import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { buildFinalMidiSnapshot, writeSmf, type FinalMidiSnapshot } from '@/lib/midiExport';
import { renderDiagnosticPreviewWav } from '../audition/simplePreviewWav';
import { buildCityPocPerformance, CITY_POC_CANDIDATES, cityPocProgressions } from './pocFixtures';

const OUT_DIR = resolve(process.env.CITY_LISTENING_DIR ?? 'LocalAnalysis/city_style/listening');
const BETWEEN_CASES_REST_BEATS = 2;

function listeningSnapshot(candidateId: (typeof CITY_POC_CANDIDATES)[number]['id']) {
  const cases = cityPocProgressions();
  const snapshots = cases.map((poc) => {
    const { plan } = buildCityPocPerformance(poc, candidateId, 90);
    return { poc, snapshot: buildFinalMidiSnapshot(plan) };
  });
  let offsetBeat = 0;
  const notes: FinalMidiSnapshot['notes'] = [];
  const controlChanges: FinalMidiSnapshot['controlChanges'] = [];
  const markers: FinalMidiSnapshot['markers'] = [];

  snapshots.forEach(({ poc, snapshot }, index) => {
    notes.push(
      ...snapshot.notes.map((note) => ({
        ...note,
        startBeat: note.startBeat + offsetBeat,
      })),
    );
    controlChanges.push(
      ...snapshot.controlChanges.map((event) => ({
        ...event,
        startBeat: event.startBeat + offsetBeat,
      })),
    );
    markers.push(
      ...snapshot.markers.map((marker) => ({
        ...marker,
        startBeat: marker.startBeat + offsetBeat,
        label: `${poc.id}: ${marker.label}`,
      })),
    );
    offsetBeat += snapshot.totalBeats;
    if (index < snapshots.length - 1) {
      offsetBeat += BETWEEN_CASES_REST_BEATS;
    }
  });

  const first = snapshots[0]!.snapshot;
  return {
    bpm: 90,
    beatsPerBar: first.beatsPerBar,
    timeSignature: first.timeSignature,
    totalBeats: offsetBeat,
    instrumentId: first.instrumentId,
    gmProgram: first.gmProgram,
    drumMode: first.drumMode,
    notes,
    controlChanges,
    markers,
  } satisfies FinalMidiSnapshot;
}

describe('City Type1 final listening pack', () => {
  it('reduces the PoC to three hypothesis-isolating files', () => {
    mkdirSync(OUT_DIR, { recursive: true });
    const files = CITY_POC_CANDIDATES.map((candidate, index) => {
      const label = String.fromCharCode('A'.charCodeAt(0) + index);
      const snapshot = listeningSnapshot(candidate.id);
      const midi = `City-Type1-${label}.mid`;
      const wav = `City-Type1-${label}.wav`;
      writeFileSync(join(OUT_DIR, midi), Buffer.from(writeSmf(snapshot)));
      writeFileSync(join(OUT_DIR, wav), Buffer.from(renderDiagnosticPreviewWav(snapshot)));
      return {
        label,
        candidateId: candidate.id,
        internalDescription: candidate.label,
        midi,
        wav,
        totalBeats: snapshot.totalBeats,
        progressionOrder: cityPocProgressions().map((poc) => ({
          id: poc.id,
          label: poc.label,
        })),
      };
    });

    writeFileSync(
      join(OUT_DIR, 'manifest.json'),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          bpm: 90,
          betweenCasesRestBeats: BETWEEN_CASES_REST_BEATS,
          releaseDecision: 'HOLD_FOR_HUMAN_LISTENING',
          files,
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(OUT_DIR, 'listening_worksheet.md'),
      [
        '# City Type1 — Final Listening',
        '',
        'Listen in this order: **A → B → C**.',
        '',
        'Each file contains:',
        '',
        '1. C | Am | F | G',
        '2. Cmaj7 | Am7 | Fmaj7 | G7',
        '3. C | Cadd9 | Cmaj7 | C7',
        '4. C | G/B | Am | F',
        '',
        'There are two beats of silence between progressions.',
        '',
        'Evaluate:',
        '',
        '- Overall',
        '- Groove',
        '- Chord Clarity',
        '- Tightness',
        '- Naturalness',
        '- Register Stability',
        '- Extension Clarity',
        '',
        'Critical question:',
        '',
        '> Does this sound like a confident human chord-comping groove rather than a MIDI chord trigger?',
        '',
        'Reply only:',
        '',
        '- `A`',
        '- `B`',
        '- `C`',
        '- `PASS` if none is release-ready',
        '',
      ].join('\n'),
    );

    expect(files).toHaveLength(3);
    expect(files.every((file) => file.totalBeats === 70)).toBe(true);
  });
});
