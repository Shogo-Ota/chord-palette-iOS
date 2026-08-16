/**
 * Standard MIDI File export — writes FinalMidiSnapshot to disk and opens Share Sheet.
 */

import * as FileSystem from 'expo-file-system/legacy';

import {
  assertExportValid,
  buildFinalMidiSnapshot,
  buildSessionPerformancePlan,
  midiExportFileName,
  writeSmf,
  type PerformanceSessionInput,
} from '@/lib/midiExport';
import { MidiExportError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { Tier } from '@/lib/performance/tier';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

async function shareMid(uri: string): Promise<void> {
  const Sharing = await import('expo-sharing');
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new MidiExportError('この端末では共有シートを開けません。');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'audio/midi',
    UTI: 'public.midi',
    dialogTitle: 'MIDIを共有',
  });
}

export const midiExportService = {
  /**
   * Build Final MIDI Events from session (same pipeline as playback), validate,
   * write .mid to cache, and open the iOS Share Sheet.
   */
  async exportAndShare(session: PerformanceSessionInput, tier: Tier = 'free'): Promise<string> {
    if (session.progression.length === 0) {
      throw new MidiExportError('コードがありません。MIDIを書き出す前に進行を作成してください。');
    }

    const plan = buildSessionPerformancePlan(session, tier);
    if (plan.totalBeats <= 0) {
      throw new MidiExportError('コードがありません。MIDIを書き出す前に進行を作成してください。');
    }

    const snapshot = buildFinalMidiSnapshot(plan);
    assertExportValid(snapshot, plan);

    const bytes = writeSmf(snapshot);
    const fileName = midiExportFileName({
      accompanimentPattern: session.accompanimentPattern,
      accompanimentVariant: session.accompanimentVariant,
      instrumentId: session.instrumentId,
      tempoBpm: session.tempoBpm,
      progression: session.progression,
    });
    const uri = `${FileSystem.cacheDirectory ?? ''}${fileName}`;
    if (!FileSystem.cacheDirectory) {
      throw new MidiExportError('キャッシュディレクトリを利用できません。');
    }
    await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), {
      encoding: FileSystem.EncodingType.Base64,
    });

    logger.info('MIDI export written', {
      uri,
      noteCount: snapshot.notes.length,
      markerCount: snapshot.markers.length,
      ccCount: snapshot.controlChanges.length,
    });

    try {
      await shareMid(uri);
    } catch (e) {
      logger.error('MIDI share failed', { error: String(e) });
      if (e instanceof MidiExportError) throw e;
      throw new MidiExportError('MIDIの共有に失敗しました。', { cause: e });
    }

    return uri;
  },
};
