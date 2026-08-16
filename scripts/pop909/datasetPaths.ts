import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const REPO_ROOT = resolve(__dirname, '../..');

export const POP909_ORIG_ROOT = join(REPO_ROOT, 'LocalDatasets/POP909/POP909');
export const POP909_CL_ROOT = join(REPO_ROOT, 'LocalDatasets/POP909-CL/POP909_processed');

export function songIdFromName(name: string): string {
  return name.replace(/\.mid$/i, '').replace(/\s+/g, '').padStart(3, '0');
}

export function listClMidiFiles(): string[] {
  if (!existsSync(POP909_CL_ROOT)) return [];
  return readdirSync(POP909_CL_ROOT)
    .filter((f) => /^\d+\s*\.mid$/i.test(f))
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
    .map((f) => join(POP909_CL_ROOT, f));
}

export function originalSongDir(id: string): string {
  return join(POP909_ORIG_ROOT, id);
}

export function originalMidiPath(id: string): string {
  return join(POP909_ORIG_ROOT, id, `${id}.mid`);
}

export function originalChordMidiTxt(id: string): string {
  return join(POP909_ORIG_ROOT, id, 'chord_midi.txt');
}

export function originalBeatMidiTxt(id: string): string {
  return join(POP909_ORIG_ROOT, id, 'beat_midi.txt');
}

export function originalKeyTxt(id: string): string {
  return join(POP909_ORIG_ROOT, id, 'key_audio.txt');
}
