import { requireOptionalNativeModule } from 'expo-modules-core';

import type { ChordVideoExportNativeModule } from './ChordVideoExport.types';

/**
 * The native encoder module, or `null` when not linked (Expo Go / JS export).
 * Callers must null-check — the VideoExportService centralizes that so screens
 * never touch this directly.
 */
export const ChordVideoExportNative =
  requireOptionalNativeModule<ChordVideoExportNativeModule>('ChordVideoExport');
