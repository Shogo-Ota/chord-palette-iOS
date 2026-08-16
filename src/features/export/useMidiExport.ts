/**
 * Standard MIDI File export, from the screen's point of view: busy state, the
 * service call, and error mapping. Screens stay presentational — they render the
 * button and surface `Outcome.message` however they like.
 */

import { useCallback, useState } from 'react';

import { MidiExportError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { PerformanceSessionInput } from '@/lib/midiExport';
import { track } from '@/services/analytics';
import { getTier } from '@/services/billing';
import { midiExportService } from '@/services/midiExport';

export type MidiExportOutcome =
  | { ok: true }
  /** Already reported to the logger — safe to show as-is. */
  | { ok: false; message: string };

export type UseMidiExport = {
  exporting: boolean;
  run: (session: PerformanceSessionInput) => Promise<MidiExportOutcome>;
};

const FALLBACK_MESSAGE = 'MIDIの書き出しに失敗しました。';

export function useMidiExport(): UseMidiExport {
  const [exporting, setExporting] = useState(false);

  const run = useCallback(async (session: PerformanceSessionInput): Promise<MidiExportOutcome> => {
    if (session.progression.length === 0) {
      return { ok: false, message: 'MIDIを書き出す前に進行を作成してください。' };
    }
    setExporting(true);
    track('midi_export_started', { chords: session.progression.length });
    try {
      await midiExportService.exportAndShare(session, getTier());
      track('midi_export_completed', { chords: session.progression.length });
      return { ok: true };
    } catch (e) {
      logger.error('MIDI export failed', { error: String(e) });
      track('midi_export_failed', {});
      return {
        ok: false,
        message: e instanceof MidiExportError ? e.userMessage : FALLBACK_MESSAGE,
      };
    } finally {
      setExporting(false);
    }
  }, []);

  return { exporting, run };
}
