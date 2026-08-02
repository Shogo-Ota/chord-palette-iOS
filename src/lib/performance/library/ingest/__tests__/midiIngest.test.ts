/**
 * Rights-ledger integrity check + ingest GENERATOR (docs/midi_dataset_policy.md).
 *
 * Always: `docs/style_datasets/midi_registry.json` must parse and every entry
 * must be structurally sound, so a broken ledger is caught in CI before anyone
 * runs the pipeline.
 *
 * Generator mode (`MIDI_INGEST=1 npx jest midiIngest`): ingests every
 * `verified` entry — parse the local MIDI, relativize, validate — and writes
 * `docs/performance/library/<id>.json` plus `ingest-report.json`. Per policy
 * rule 6 the run NEVER halts on a missing/broken file; the failure is recorded
 * in the report and the next entry proceeds.
 */

import * as fs from 'fs';
import * as path from 'path';

import type { MidiRegistry } from '../registry';
import { registryEntryProblems, selectIngestible } from '../registry';
import { relativizeSmf } from '../relativize';
import { parseSmf } from '../smf';

const REGISTRY_PATH = 'docs/style_datasets/midi_registry.json';
const OUT_DIR = 'docs/performance/library';
const VALID_STATUSES = ['verified', 'manual_review_required', 'rejected'];

function loadRegistry(): MidiRegistry {
  const abs = path.resolve(process.cwd(), REGISTRY_PATH);
  return JSON.parse(fs.readFileSync(abs, 'utf8')) as MidiRegistry;
}

describe('midi registry ledger', () => {
  const registry = loadRegistry();

  it('parses and declares a known version', () => {
    expect(registry.version).toBe(1);
    expect(Array.isArray(registry.entries)).toBe(true);
  });

  it('every entry has a unique id and a valid verification status', () => {
    const ids = registry.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of registry.entries) {
      expect(VALID_STATUSES).toContain(e.rights?.verificationStatus);
    }
  });

  it('every VERIFIED entry passes ledger validation (rights fields present)', () => {
    for (const e of registry.entries.filter((x) => x.rights?.verificationStatus === 'verified')) {
      expect({ id: e.id, problems: registryEntryProblems(e) }).toEqual({
        id: e.id,
        problems: [],
      });
    }
  });

  it('ingests verified entries and writes patterns when MIDI_INGEST is set', () => {
    if (!process.env.MIDI_INGEST) return; // generator mode only

    const { ingestible, skipped } = selectIngestible(registry);
    const results: Record<string, unknown>[] = [];
    const outAbs = path.resolve(process.cwd(), OUT_DIR);
    fs.mkdirSync(outAbs, { recursive: true });

    for (const entry of ingestible) {
      const fileAbs = path.resolve(process.cwd(), entry.file);
      if (!fs.existsSync(fileAbs)) {
        results.push({ id: entry.id, ok: false, reason: `file not found: ${entry.file}` });
        continue; // policy rule 6: keep going
      }
      try {
        const song = parseSmf(new Uint8Array(fs.readFileSync(fileAbs)));
        const { pattern, report } = relativizeSmf(song, entry);
        if (pattern) {
          fs.writeFileSync(
            path.join(outAbs, `${entry.id}.json`),
            JSON.stringify(pattern, null, 2),
          );
        }
        results.push({ id: entry.id, ok: pattern !== null, report });
      } catch (e) {
        results.push({ id: entry.id, ok: false, reason: String(e) });
      }
    }

    const summary = {
      generatedAt: new Date().toISOString(),
      registry: REGISTRY_PATH,
      ingested: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      skipped,
      results,
    };
    fs.writeFileSync(path.join(outAbs, 'ingest-report.json'), JSON.stringify(summary, null, 2));
    expect(fs.existsSync(path.join(outAbs, 'ingest-report.json'))).toBe(true);
  });
});
