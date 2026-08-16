/**
 * Filesystem loader for Groove MIDI Dataset (dev / Jest only).
 * Never used on the app render path. Raw MIDI stays outside git.
 */

import * as fs from 'fs';
import * as path from 'path';

import { buildGmdDrumProfile, parseGmdInfoCsv, type GmdFileInput } from './gmdStats';
import type { GmdDrumProfile, GmdInfoRow } from './gmdTypes';

export const GMD_DRUM_PROFILE_PINNED_PATH =
  'docs/performance/humanize/gmd_drum_profile_v1.json';

export function resolveGmdRoot(env: NodeJS.ProcessEnv = process.env): string | null {
  const fromEnv = env.GMD_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  const fallback = path.resolve(
    process.env.HOME ?? process.env.USERPROFILE ?? '',
    'Downloads/groove-v1.0.0-midionly/groove',
  );
  if (fs.existsSync(path.join(fallback, 'info.csv'))) return fallback;
  return null;
}

export function loadGmdInfo(root: string): GmdInfoRow[] {
  const csvPath = path.join(root, 'info.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`GMD info.csv not found at ${csvPath}`);
  }
  return parseGmdInfoCsv(fs.readFileSync(csvPath, 'utf8'));
}

export function loadGmdFiles(
  root: string,
  options: { maxFiles?: number; beatType?: 'beat' | 'fill' | 'all' } = {},
): GmdFileInput[] {
  const { maxFiles, beatType = 'all' } = options;
  const rows = loadGmdInfo(root);
  const out: GmdFileInput[] = [];
  for (const info of rows) {
    if (beatType !== 'all' && info.beatType !== beatType) continue;
    const abs = path.join(root, info.midiFilename);
    if (!fs.existsSync(abs)) continue;
    out.push({ info, bytes: new Uint8Array(fs.readFileSync(abs)) });
    if (maxFiles !== undefined && out.length >= maxFiles) break;
  }
  return out;
}

export function analyzeGmdRoot(
  root: string,
  options: { maxFiles?: number; beatType?: 'beat' | 'fill' | 'all'; now?: () => string } = {},
): GmdDrumProfile {
  const files = loadGmdFiles(root, options);
  return buildGmdDrumProfile(files, options.now);
}

export function writeGmdDrumProfile(profile: GmdDrumProfile, cwd: string = process.cwd()): string {
  const abs = path.resolve(cwd, GMD_DRUM_PROFILE_PINNED_PATH);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(profile, null, 2) + '\n');
  return abs;
}
