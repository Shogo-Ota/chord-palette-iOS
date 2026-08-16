/**
 * Pure statistics over parsed GMD performances → GmdDrumProfile (MEASURED).
 * No filesystem I/O here — callers supply bytes + info.csv rows.
 */

import { parseSmf, type SmfSong } from '../library/ingest/smf';
import { CORE_GMD_VOICES, gmdVoiceOf, type GmdVoice } from './gmdDrumMap';
import type {
  GmdDrumProfile,
  GmdInfoRow,
  TempoBinId,
  TempoBinProfile,
  TimingStats,
  VelocityStats,
  VoiceBinStats,
} from './gmdTypes';

const GRID_DIVISIONS_PER_BEAT = 4; // 16th-note grid in 4/4
const GHOST_VELOCITY_MAX = 40;

export const DEFAULT_TEMPO_BINS: readonly TempoBinId[] = [
  { minBpm: 0, maxBpm: 80, label: 'lt80' },
  { minBpm: 80, maxBpm: 100, label: '80-100' },
  { minBpm: 100, maxBpm: 120, label: '100-120' },
  { minBpm: 120, maxBpm: 140, label: '120-140' },
  { minBpm: 140, maxBpm: 1e9, label: 'gte140' },
];

export const GMD_ATTRIBUTION =
  'Groove MIDI Dataset © Google LLC, licensed under CC BY 4.0 — https://magenta.withgoogle.com/datasets/groove';

export const GMD_CITATION =
  'Jon Gillick, Adam Roberts, Jesse Engel, Douglas Eck, and David Bamman. "Learning to Groove with Inverse Sequence Transformations." ICML 2019.';

interface HitSample {
  voice: GmdVoice;
  velocity: number;
  /** Onset in beats from file start (using annotated BPM + ppq). */
  beat: number;
  signedDevBeats: number;
  absDevBeats: number;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m))));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  const t = i - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
}

function tempoBinOf(bpm: number, bins: readonly TempoBinId[]): TempoBinId {
  for (const b of bins) {
    if (bpm >= b.minBpm && bpm < b.maxBpm) return b;
  }
  return bins[bins.length - 1];
}

function primaryStyle(style: string): string {
  const i = style.indexOf('/');
  return i < 0 ? style : style.slice(0, i);
}

/** Parse info.csv text into rows (skips header). */
export function parseGmdInfoCsv(text: string): GmdInfoRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  const idx = (name: string) => header.indexOf(name);
  const iDrummer = idx('drummer');
  const iId = idx('id');
  const iStyle = idx('style');
  const iBpm = idx('bpm');
  const iBeat = idx('beat_type');
  const iTs = idx('time_signature');
  const iMidi = idx('midi_filename');
  const iSplit = idx('split');
  const iDur = idx('duration');
  const rows: GmdInfoRow[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = lines[li].split(',');
    if (cols.length < header.length) continue;
    rows.push({
      drummer: cols[iDrummer],
      id: cols[iId],
      style: cols[iStyle],
      bpm: Number(cols[iBpm]),
      beatType: cols[iBeat],
      timeSignature: cols[iTs],
      midiFilename: cols[iMidi],
      split: cols[iSplit],
      duration: Number(cols[iDur]),
    });
  }
  return rows;
}

/**
 * Extract per-hit samples from one SMF + annotated BPM.
 * Timing is measured against a 16th grid in beats (ppq → beats via ticks/ppq).
 */
export function extractHits(song: SmfSong, bpm: number): HitSample[] {
  const ppq = song.ppq;
  const grid = 1 / GRID_DIVISIONS_PER_BEAT;
  const out: HitSample[] = [];
  for (const n of song.notes) {
    const voice = gmdVoiceOf(n.pitch);
    const beat = n.tick / ppq;
    const nearest = Math.round(beat / grid) * grid;
    const signed = beat - nearest;
    out.push({
      voice,
      velocity: n.velocity,
      beat,
      signedDevBeats: signed,
      absDevBeats: Math.abs(signed),
    });
  }
  void bpm; // reserved: ms conversion uses caller bpm at aggregation time
  return out;
}

function velocityStats(hits: HitSample[]): VelocityStats {
  const vs = hits.map((h) => h.velocity).sort((a, b) => a - b);
  const ghost = hits.filter((h) => h.velocity <= GHOST_VELOCITY_MAX).length;
  return {
    count: vs.length,
    mean: mean(vs),
    stdDev: stdDev(vs),
    p10: percentile(vs, 0.1),
    p50: percentile(vs, 0.5),
    p90: percentile(vs, 0.9),
    ghostRate: vs.length === 0 ? 0 : ghost / vs.length,
  };
}

function timingStats(hits: HitSample[], bpm: number): TimingStats {
  const abs = hits.map((h) => h.absDevBeats);
  const signed = hits.map((h) => h.signedDevBeats);
  const msPerBeat = bpm > 0 ? 60000 / bpm : 0;
  const absMean = mean(abs);
  const signedMean = mean(signed);
  return {
    count: hits.length,
    absDeviationMeanBeats: absMean,
    absDeviationStdDevBeats: stdDev(abs),
    signedDeviationMeanBeats: signedMean,
    absDeviationMeanMs: absMean * msPerBeat,
    signedDeviationMeanMs: signedMean * msPerBeat,
  };
}

function voiceStats(hits: HitSample[], bpm: number): Partial<Record<GmdVoice, VoiceBinStats>> {
  const byVoice = new Map<GmdVoice, HitSample[]>();
  for (const h of hits) {
    byVoice.set(h.voice, [...(byVoice.get(h.voice) ?? []), h]);
  }
  const out: Partial<Record<GmdVoice, VoiceBinStats>> = {};
  for (const [voice, list] of byVoice) {
    out[voice] = {
      voice,
      velocity: velocityStats(list),
      timing: timingStats(list, bpm),
    };
  }
  return out;
}

export interface GmdFileInput {
  info: GmdInfoRow;
  bytes: Uint8Array;
}

/**
 * Aggregate many GMD files into a Measured drum Humanize Profile.
 * Failed parses are counted and skipped (pipeline never halts).
 */
export function buildGmdDrumProfile(
  files: readonly GmdFileInput[],
  now: () => string = () => new Date().toISOString(),
  tempoBins: readonly TempoBinId[] = DEFAULT_TEMPO_BINS,
): GmdDrumProfile {
  let filesParsed = 0;
  let filesFailed = 0;
  let totalHits = 0;
  let fillFiles = 0;

  type Acc = { hits: HitSample[]; bpmSum: number; n: number };
  const overallHits: HitSample[] = [];
  const binAcc = new Map<string, { bin: TempoBinId; files: number; fills: number; beats: number; hits: HitSample[]; bpmSum: number }>();
  const styleAcc = new Map<string, Acc>();

  for (const f of files) {
    let song: SmfSong;
    try {
      song = parseSmf(f.bytes);
    } catch {
      filesFailed += 1;
      continue;
    }
    filesParsed += 1;
    const hits = extractHits(song, f.info.bpm);
    totalHits += hits.length;
    overallHits.push(...hits);
    if (f.info.beatType === 'fill') fillFiles += 1;

    const bin = tempoBinOf(f.info.bpm, tempoBins);
    const b = binAcc.get(bin.label) ?? {
      bin,
      files: 0,
      fills: 0,
      beats: 0,
      hits: [] as HitSample[],
      bpmSum: 0,
    };
    b.files += 1;
    if (f.info.beatType === 'fill') b.fills += 1;
    else b.beats += 1;
    b.hits.push(...hits);
    b.bpmSum += f.info.bpm;
    binAcc.set(bin.label, b);

    const ps = primaryStyle(f.info.style);
    const s = styleAcc.get(ps) ?? { hits: [], bpmSum: 0, n: 0 };
    s.hits.push(...hits);
    s.bpmSum += f.info.bpm;
    s.n += 1;
    styleAcc.set(ps, s);
  }

  const overallBpm =
    filesParsed === 0
      ? 120
      : mean(
          [...binAcc.values()].flatMap((b) =>
            b.files > 0 ? [b.bpmSum / b.files] : [],
          ),
        ) || 120;

  const byTempoBin: TempoBinProfile[] = tempoBins.map((bin) => {
    const acc = binAcc.get(bin.label);
    const avgBpm = acc && acc.files > 0 ? acc.bpmSum / acc.files : (bin.minBpm + Math.min(bin.maxBpm, 200)) / 2;
    return {
      bin,
      fileCount: acc?.files ?? 0,
      hitCount: acc?.hits.length ?? 0,
      beatFileCount: acc?.beats ?? 0,
      fillFileCount: acc?.fills ?? 0,
      byVoice: voiceStats(acc?.hits ?? [], avgBpm),
    };
  });

  const byPrimaryStyle: GmdDrumProfile['byPrimaryStyle'] = {};
  for (const [style, acc] of styleAcc) {
    const avgBpm = acc.n > 0 ? acc.bpmSum / acc.n : overallBpm;
    byPrimaryStyle[style] = {
      fileCount: acc.n,
      hitCount: acc.hits.length,
      byVoice: voiceStats(acc.hits, avgBpm),
    };
  }

  // Prefer core voices in overall summary ordering (others still included).
  const overallByVoice = voiceStats(overallHits, overallBpm);
  void CORE_GMD_VOICES;

  return {
    profileVersion: 'gmd-drum-v1',
    dataClass: 'measured',
    source: {
      datasetName: 'Groove MIDI Dataset',
      datasetVersion: 'v1.0.0-midionly',
      officialURL: 'https://magenta.withgoogle.com/datasets/groove',
      license: 'CC BY 4.0',
      licensor: 'Google LLC',
      attribution: GMD_ATTRIBUTION,
      citation: GMD_CITATION,
    },
    analysis: {
      gridDivisionsPerBeat: GRID_DIVISIONS_PER_BEAT,
      ghostVelocityMax: GHOST_VELOCITY_MAX,
      tempoBins: [...tempoBins],
      filesParsed,
      filesFailed,
      totalHits,
    },
    generatedAt: now(),
    overall: {
      byVoice: overallByVoice,
      fillFileRate: filesParsed === 0 ? 0 : fillFiles / filesParsed,
    },
    byTempoBin,
    byPrimaryStyle,
  };
}
