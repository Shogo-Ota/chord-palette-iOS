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
export const FREE_INSTRUMENTS: InstrumentId[] = ['piano', 'ePiano'];
/** Pro instruments, in selector order. */
export const PRO_INSTRUMENTS: InstrumentId[] = ['acousticGuitar', 'electricGuitar', 'strings'];

/**
 * Instruments actually selectable in the app right now. Kept as a single switch
 * so more voices can be enabled later without touching the UI: the bundled
 * SoundFont already contains all GM programs and native maps every id to one
 * (see AudioEngineController.programForInstrument). To add e.g. strings later,
 * just append 'strings' here (and revisit Pro gating if it should be paid).
 */
export const ENABLED_INSTRUMENTS: InstrumentId[] = ['piano', 'ePiano'];

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

/** Accompaniment patterns (all free — requirements §6). */
export const ACCOMPANIMENT_LABELS: Record<AccompanimentPattern, string> = {
  block: 'Block',
  arpeggio: 'Arpeggio',
  natural: 'Natural',
  driving: 'Driving',
  relaxed: 'Relaxed',
};

export const ACCOMPANIMENT_IDS: AccompanimentPattern[] = [
  'block',
  'arpeggio',
  'natural',
  'driving',
  'relaxed',
];
