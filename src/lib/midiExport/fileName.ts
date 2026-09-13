/**
 * MIDI export file name. Pure, no RN/Expo.
 *
 * chord-palette-{Style}-{Instrument}-{BPM}bpm-{Progression}-{Timestamp}.mid
 *
 * Deterministic except the Unix-ms timestamp. The STYLE segment names what the player
 * selected, read from the public STYLE catalog — never the internal pattern or variant
 * id that happens to implement it.
 */

import { publicStyleExportLabel } from '@/lib/performance/publicStyleCatalog';
import type { AccompanimentPattern, InstrumentId } from '@/types';

const INSTRUMENT_SLUG: Partial<Record<InstrumentId, string>> = {
  piano: 'Piano',
  ePiano: 'E.Piano',
  acousticGuitar: 'AcousticGuitar',
  electricGuitar: 'ElectricGuitar',
  strings: 'Strings',
};

const MAX_PROGRESSION_CHORDS = 8;

function sanitize(raw: string, emptyFallback: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9._]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned.length > 0 ? cleaned : emptyFallback;
}

function chordToken(displayName: string): string {
  return sanitize(
    displayName
      .replace(/♭/g, 'b')
      .replace(/♯/g, 's')
      .replace(/#/g, 's')
      .replace(/\//g, '_on_'),
    'Chord',
  );
}

/** The STYLE the player selected, spelled for a file name. */
export function midiExportStyleToken(
  pattern: AccompanimentPattern,
  variantId?: string,
): string {
  return sanitize(publicStyleExportLabel(pattern, variantId), 'Style');
}

export function midiExportInstrumentToken(instrumentId: InstrumentId): string {
  return INSTRUMENT_SLUG[instrumentId] ?? sanitize(instrumentId, 'Piano');
}

export function midiExportBpmToken(tempoBpm: number): string {
  const bpm = Number.isFinite(tempoBpm) ? Math.round(tempoBpm) : 0;
  return `${bpm}bpm`;
}

export function midiExportProgressionToken(
  progression: readonly { displayName: string }[],
): string {
  if (progression.length === 0) return 'NoChords';
  const names = progression.slice(0, MAX_PROGRESSION_CHORDS).map((c) => chordToken(c.displayName));
  const body = names.join('-');
  return progression.length > MAX_PROGRESSION_CHORDS ? `${body}-etc` : body;
}

export function midiExportFileName(input: {
  accompanimentPattern: AccompanimentPattern;
  accompanimentVariant?: string;
  instrumentId: InstrumentId;
  tempoBpm: number;
  progression: readonly { displayName: string }[];
  now?: number;
}): string {
  const style = midiExportStyleToken(input.accompanimentPattern, input.accompanimentVariant);
  const instrument = midiExportInstrumentToken(input.instrumentId);
  const bpm = midiExportBpmToken(input.tempoBpm);
  const chords = midiExportProgressionToken(input.progression);
  const now = input.now ?? Date.now();
  return `chord-palette-${style}-${instrument}-${bpm}-${chords}-${now}.mid`;
}
