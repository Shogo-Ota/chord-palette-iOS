import type { ChordHarmonyInput, TemplateNote } from '../strictV2';
import { compileProductionNote } from './degreePitch';

export interface HumanTemplateAttack {
  musicalBarInLoop: number;
  beatInMusicalBar: number;
  timingOffsetBeats?: number;
  attackType?: string;
  relativeVelocity?: number;
  notes: TemplateNote[];
}

export interface HumanTemplatePedalEvent {
  musicalBar: number;
  beatInMusicalBar: number;
  state: 'down' | 'up';
  value: number;
}

export interface HumanMidiTemplate {
  id: string;
  sourceId: string;
  category: 'normal' | 'ballad' | 'arpeggio' | 'variation';
  meter: { beatsPerBar: number; beatUnit: number };
  loopBars: number;
  /** Teacher loop roots (0–11), index 0 = musical bar 1. Used for Pure Transpose. */
  sourceLoopRoots?: number[];
  attacks: HumanTemplateAttack[];
  pedalEvents?: HumanTemplatePedalEvent[];
}

export interface RawSourceChord {
  musicalBarInLoop: number;
  symbol?: string;
  rootPc: number;
  quality?: string;
  chordIntervals: readonly number[];
}

export interface RawHumanTemplateJson {
  id: string;
  sourceId: string;
  meter?: { beatsPerBar: number; beatUnit: number };
  timeline?: { loopBars?: number; musicalOriginTick?: number; ppq?: number };
  sourceChords?: {
    loop?: RawSourceChord[];
  };
  attacks: Array<{
    musicalBarInLoop: number;
    beatInMusicalBar: number;
    timingOffsetBeats?: number;
    absoluteTick?: number;
    attackType?: string;
    relativeVelocity?: number;
    notes: TemplateNote[];
  }>;
  pedalEvents?: Array<{
    musicalBar: number;
    beatInMusicalBar: number;
    absoluteTick?: number;
    state: 'down' | 'up';
    value: number;
  }>;
}

function sourceHarmonyForBar(
  raw: RawHumanTemplateJson,
  barInLoop: number,
): ChordHarmonyInput | undefined {
  const entry = raw.sourceChords?.loop?.find((c) => c.musicalBarInLoop === barInLoop);
  if (!entry) return undefined;
  return {
    symbol: entry.symbol ?? '',
    rootPc: entry.rootPc,
    quality: entry.quality ?? 'maj',
    chordIntervals: entry.chordIntervals,
  };
}

function wrapPc(n: number): number {
  return ((n % 12) + 12) % 12;
}

export function normalizeHumanTemplate(
  raw: RawHumanTemplateJson,
  category: HumanMidiTemplate['category'],
): HumanMidiTemplate {
  const loopBars = raw.timeline?.loopBars ?? 4;
  const sourceLoop = raw.sourceChords?.loop;
  const sourceLoopRoots = sourceLoop?.length
    ? Array.from({ length: loopBars }, (_, i) => {
        const entry = sourceLoop.find((c) => c.musicalBarInLoop === i + 1);
        return entry ? wrapPc(entry.rootPc) : undefined;
      })
    : undefined;
  const roots =
    sourceLoopRoots && sourceLoopRoots.every((r): r is number => r !== undefined)
      ? sourceLoopRoots
      : undefined;

  return {
    id: raw.id,
    sourceId: raw.sourceId,
    category,
    meter: raw.meter ?? { beatsPerBar: 4, beatUnit: 4 },
    loopBars,
    sourceLoopRoots: roots,
    attacks: raw.attacks.map((a, attackIndex) => {
      const source = sourceHarmonyForBar(raw, a.musicalBarInLoop);
      const beatsPerBar = raw.meter?.beatsPerBar ?? 4;
      const origin = raw.timeline?.musicalOriginTick;
      const ppq = raw.timeline?.ppq ?? 480;
      let beatInBar = a.beatInMusicalBar + (a.timingOffsetBeats ?? 0);
      if (origin !== undefined && a.absoluteTick !== undefined) {
        beatInBar = (a.absoluteTick - origin) / ppq - (a.musicalBarInLoop - 1) * beatsPerBar;
      }
      return {
        musicalBarInLoop: a.musicalBarInLoop,
        beatInMusicalBar: beatInBar,
        timingOffsetBeats: 0,
        attackType: a.attackType,
        relativeVelocity: a.relativeVelocity,
        notes: a.notes.map((note) => compileProductionNote(note, source, attackIndex)),
      };
    }),
    pedalEvents: raw.pedalEvents
      ?.filter((p) => p.musicalBar <= (raw.timeline?.loopBars ?? 4))
      .map((p) => {
        const beatsPerBar = raw.meter?.beatsPerBar ?? 4;
        const origin = raw.timeline?.musicalOriginTick;
        const ppq = raw.timeline?.ppq ?? 480;
        let beatInBar = p.beatInMusicalBar;
        if (origin !== undefined && p.absoluteTick !== undefined) {
          beatInBar = (p.absoluteTick - origin) / ppq - (p.musicalBar - 1) * beatsPerBar;
        }
        return {
          musicalBar: p.musicalBar,
          beatInMusicalBar: beatInBar,
          state: p.state,
          value: p.value,
        };
      }),
  };
}
