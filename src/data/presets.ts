import type { Preset } from '@/types';

/**
 * The user-facing progression preset catalog. Intentionally EMPTY: presets are now
 * curated by the user (they'll populate this later), so the app ships no built-in
 * catalog. The presets screen renders an empty state; the type + screen + builder
 * (src/lib/presets.ts) stay intact so adding entries here is the only change needed.
 */
export const PRESETS: Preset[] = [];

/**
 * Starter progression used to seed a NEW session / the first-launch demo — this is
 * NOT part of the (empty) catalog above, it only keeps "新しい進行を作る" playable
 * instead of a blank canvas (UI retention §6). J-POP 王道進行 (4536: IV-V-iii-vi),
 * stored by degree so it auto-transposes to any key.
 */
export const STARTER_PRESET: Preset = {
  id: 'starter-royal',
  name: 'はじめての進行',
  category: 'free',
  chordsDisplay: 'F · G · Em · Am',
  tags: ['明るい', '王道', 'サビ向き'],
  accent: '#eab308',
  chords: [
    { offset: 5, suffix: '', function: 'subdominant', degreeLabel: 'IV', durationBeats: 4 },
    { offset: 7, suffix: '', function: 'dominant', degreeLabel: 'V', durationBeats: 4 },
    { offset: 4, suffix: 'm', function: 'tonic', degreeLabel: 'iii', durationBeats: 4 },
    { offset: 9, suffix: 'm', function: 'tonic', degreeLabel: 'vi', durationBeats: 4 },
  ],
};
