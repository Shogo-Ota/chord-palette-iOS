import { requireOptionalNativeModule } from 'expo-modules-core';

import type { ChordAudioNativeModule } from './ChordAudio.types';

/**
 * The native module, or `null` when it is not linked into the current binary
 * (e.g. Expo Go or a JS-only export). Callers must null-check — the AudioService
 * (`src/services/audio`) centralizes that so screens never touch this directly.
 */
export const ChordAudioNative = requireOptionalNativeModule<ChordAudioNativeModule>('ChordAudio');
