import { RHYTHMS, RHYTHM_IDS } from '@/lib/performance/rhythms';
import type { AccompanimentPattern, GrooveId, InstrumentId } from '@/types';

/** Display names for instruments (requirements §6). */
export const INSTRUMENT_LABELS: Record<InstrumentId, string> = {
  piano: 'Piano',
  ePiano: 'E.Piano',
  acousticGuitar: 'Acoustic Guitar',
  electricGuitar: 'Electric Guitar',
  strings: 'Strings',
};

/** Which instruments require Palette Pro (requirements §7). Piano/E.Piano are free. */
export const INSTRUMENT_IS_PRO: Record<InstrumentId, boolean> = {
  piano: false,
  ePiano: false,
  acousticGuitar: true,
  electricGuitar: true,
  strings: true,
};

/** Free instruments, in selector order. */
export const FREE_INSTRUMENTS: InstrumentId[] = ['piano'];
/** Pro instruments, in selector order. */
export const PRO_INSTRUMENTS: InstrumentId[] = ['acousticGuitar', 'electricGuitar', 'strings'];

/**
 * Instruments actually selectable in the app right now. Kept as a single switch
 * so more voices can be enabled later without touching the UI: the bundled
 * SoundFont already contains all GM programs and native maps every id to one
 * (see AudioEngineController.programForInstrument). ePiano is retired from the
 * product UI (the Rhodes SF2 read as cheap on device).
 */
export const ENABLED_INSTRUMENTS: InstrumentId[] = ['piano'];

/** Map a stored / retired id onto a voice the UI still offers. */
export function normalizeInstrumentId(raw: unknown): InstrumentId {
  if (raw === 'ePiano') return 'piano';
  if (
    raw === 'piano' ||
    raw === 'acousticGuitar' ||
    raw === 'electricGuitar' ||
    raw === 'strings'
  ) {
    return raw;
  }
  return 'piano';
}

/**
 * Drum grooves (all free — requirements §6). The selector now shows single choices
 * (see `src/data/grooveMenu.ts`): "8 Beat" (`pop8`), "16 Beat" (`soul16`), "Clap",
 * "Bossa Nova". `rock8` / `pop16` / `rock16` are retired from the selector — their
 * pockets read almost identical to the kept grooves — but their labels stay for
 * saved projects that still reference the legacy ids.
 */
export const GROOVE_LABELS: Record<GrooveId, string> = {
  pop8: '8 Beat',
  rock8: '8 Beat (Rock)',
  pop16: '16 Beat (Pop)',
  rock16: '16 Beat (Rock)',
  soul16: '16 Beat',
  clap: 'Clap',
  bossaNova: 'Bossa Nova',
};

export const GROOVE_IDS: GrooveId[] = [
  'pop8',
  'rock8',
  'pop16',
  'rock16',
  'soul16',
  'clap',
  'bossaNova',
];

/**
 * Accompaniment patterns (all free — requirements §6). Labels and order come from the
 * rhythm catalog, which is also what tells the engine what each id means, so the chip
 * a player taps and the skeleton they hear can never describe different things.
 */
export const ACCOMPANIMENT_LABELS: Record<AccompanimentPattern, string> = Object.fromEntries(
  RHYTHMS.map((r) => [r.id, r.label]),
) as Record<AccompanimentPattern, string>;

export const ACCOMPANIMENT_IDS: readonly AccompanimentPattern[] = RHYTHM_IDS;

/** One-line description of the selected accompaniment, shown under the selector. */
export const ACCOMPANIMENT_HINTS: Record<AccompanimentPattern, string> = Object.fromEntries(
  RHYTHMS.map((r) => [r.id, r.hint]),
) as Record<AccompanimentPattern, string>;
