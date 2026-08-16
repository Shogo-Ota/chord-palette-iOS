/**
 * GMD → Measured drum Humanize Profile pipeline.
 *
 * Requires local Groove MIDI Dataset (midionly). See:
 *   docs/data_collection/gmd_acquisition.md
 *
 * Generate / refresh pinned stats JSON:
 *   GMD_ROOT="C:/Users/shogo/Downloads/groove-v1.0.0-midionly/groove" \
 *   GMD_PROFILE_WRITE=1 \
 *   npx jest gmdPipeline
 *
 * Without GMD_ROOT (and without the Downloads fallback), the suite skips.
 * CI does not download MIDI.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  analyzeGmdRoot,
  GMD_DRUM_PROFILE_PINNED_PATH,
  resolveGmdRoot,
  writeGmdDrumProfile,
} from '@/lib/performance/humanize/gmdLoad';

const gmdRoot = resolveGmdRoot();
const describeIfGmd = gmdRoot ? describe : describe.skip;

describeIfGmd('GMD drum Humanize pipeline', () => {
  const root = gmdRoot as string;
  const fixedNow = () => '2026-08-03T00:00:00.000Z';

  it('loads LICENSE + info.csv and parses the full midionly set', () => {
    expect(fs.existsSync(path.join(root, 'LICENSE'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'info.csv'))).toBe(true);
    const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
    expect(license.toLowerCase()).toContain('creative commons attribution 4.0');

    const profile = analyzeGmdRoot(root, { now: fixedNow });
    expect(profile.analysis.filesParsed).toBeGreaterThanOrEqual(1100);
    expect(profile.analysis.filesFailed).toBeLessThan(50);
    expect(profile.analysis.totalHits).toBeGreaterThan(100_000);
    expect(profile.overall.byVoice.kick?.velocity.count).toBeGreaterThan(0);
    expect(profile.overall.byVoice.snare?.velocity.count).toBeGreaterThan(0);
    expect(profile.byTempoBin.some((b) => b.fileCount > 0)).toBe(true);
    expect(Object.keys(profile.byPrimaryStyle).length).toBeGreaterThan(5);

    if (process.env.GMD_PROFILE_WRITE === '1') {
      const abs = writeGmdDrumProfile(profile);
      expect(fs.existsSync(abs)).toBe(true);
    } else {
      const pinned = path.resolve(process.cwd(), GMD_DRUM_PROFILE_PINNED_PATH);
      if (fs.existsSync(pinned)) {
        const existing = JSON.parse(fs.readFileSync(pinned, 'utf8')) as {
          profileVersion: string;
          analysis: { filesParsed: number; totalHits: number };
        };
        expect(existing.profileVersion).toBe('gmd-drum-v1');
        expect(existing.analysis.filesParsed).toBe(profile.analysis.filesParsed);
        expect(existing.analysis.totalHits).toBe(profile.analysis.totalHits);
      }
    }
  });
});

describe('GMD pipeline availability', () => {
  it('documents how to obtain GMD when the suite is skipped', () => {
    if (!gmdRoot) {
      // eslint-disable-next-line no-console
      console.warn(
        '[gmdPipeline] GMD_ROOT not set and default Downloads path missing — skipped. See docs/data_collection/gmd_acquisition.md',
      );
    }
    expect(true).toBe(true);
  });
});
