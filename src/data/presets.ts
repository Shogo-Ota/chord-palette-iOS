import type { Preset } from '@/types';

/**
 * The user-facing progression preset catalog.
 *
 * Presets are stored by *degree* (semitone offset from the tonic), never by fixed
 * chord name, so they transpose with the project key — see `buildPresetProgression`.
 *
 * Tier rule (requirements §6/§7, and the reason this catalog exists at all): a `free`
 * preset must be playable end-to-end with free chords (triads + diatonic sevenths),
 * and a `pro` preset must actually need a Palette Pro chord — a secondary dominant,
 * a borrowed chord, or a slash chord. Locking a progression a free user could rebuild
 * chord-by-chord would be a paywall with nothing behind it, and shipping a Pro tier
 * that advertises presets it does not have is what App Review flagged under 2.3.1.
 * `src/data/__tests__/presets.test.ts` enforces both halves of that rule.
 *
 * Names are deliberately descriptive rather than song- or person-derived (requirements
 * L277): the progressions themselves are not protectable, but naming a feature after a
 * specific record or artist is.
 */
export const PRESETS: Preset[] = [
  /* ---------------------------------------------------------------- */
  /* Free — triads and diatonic sevenths only                          */
  /* ---------------------------------------------------------------- */
  {
    id: 'royal-4536',
    name: '王道進行',
    category: 'free',
    chordsDisplay: 'F · G · Em · Am',
    tags: ['明るい', '王道', 'サビ向き'],
    accent: '#eab308',
    // 4536: IV - V - iii - vi
    chords: [
      { offset: 5, suffix: '', function: 'subdominant', degreeLabel: 'IV', durationBeats: 4 },
      { offset: 7, suffix: '', function: 'dominant', degreeLabel: 'V', durationBeats: 4 },
      { offset: 4, suffix: 'm', function: 'tonic', degreeLabel: 'iii', durationBeats: 4 },
      { offset: 9, suffix: 'm', function: 'tonic', degreeLabel: 'vi', durationBeats: 4 },
    ],
  },
  {
    id: 'pop-punk',
    name: 'ポップパンク進行',
    category: 'free',
    chordsDisplay: 'C · G · Am · F',
    tags: ['疾走感', 'バンド', '前向き'],
    accent: '#ef4444',
    // I - V - vi - IV
    chords: [
      { offset: 0, suffix: '', function: 'tonic', degreeLabel: 'I', durationBeats: 4 },
      { offset: 7, suffix: '', function: 'dominant', degreeLabel: 'V', durationBeats: 4 },
      { offset: 9, suffix: 'm', function: 'tonic', degreeLabel: 'vi', durationBeats: 4 },
      { offset: 5, suffix: '', function: 'subdominant', degreeLabel: 'IV', durationBeats: 4 },
    ],
  },
  {
    id: 'sad-loop',
    name: '切ないループ',
    category: 'free',
    chordsDisplay: 'Am · F · G · C',
    tags: ['切ない', 'ドラマチック', '定番'],
    accent: '#8b5cf6',
    // vi - IV - V - I
    chords: [
      { offset: 9, suffix: 'm', function: 'tonic', degreeLabel: 'vi', durationBeats: 4 },
      { offset: 5, suffix: '', function: 'subdominant', degreeLabel: 'IV', durationBeats: 4 },
      { offset: 7, suffix: '', function: 'dominant', degreeLabel: 'V', durationBeats: 4 },
      { offset: 0, suffix: '', function: 'tonic', degreeLabel: 'I', durationBeats: 4 },
    ],
  },

  /* ---------------------------------------------------------------- */
  /* Palette Pro — each one needs a chord the free tier cannot place   */
  /* ---------------------------------------------------------------- */
  {
    id: 'royal-secondary',
    name: '王道アレンジ',
    category: 'pro',
    chordsDisplay: 'Fmaj7 · G7 · E7 · Am7',
    tags: ['王道', 'エモい', 'セカンダリー'],
    accent: '#d6409f',
    // The free 王道進行 with the iii swapped for V7/vi — the smallest step from the
    // free catalog into Pro territory, so the upgrade has an audible before/after.
    chords: [
      { offset: 5, suffix: 'maj7', function: 'subdominant', degreeLabel: 'IVmaj7', durationBeats: 4 },
      { offset: 7, suffix: '7', function: 'dominant', degreeLabel: 'V7', durationBeats: 4 },
      { offset: 4, suffix: '7', function: 'dominant', degreeLabel: 'V7/vi', durationBeats: 4 },
      { offset: 9, suffix: 'm7', function: 'tonic', degreeLabel: 'vim7', durationBeats: 4 },
    ],
  },
  {
    id: 'jazzy-loop',
    name: 'おしゃれ循環',
    category: 'pro',
    chordsDisplay: 'Fmaj7 · E7 · Am7 · Gm7 · C7',
    tags: ['おしゃれ', 'ジャジー', '都会的'],
    accent: '#3b82f6',
    // IVmaj7 - V7/vi - vim7 - vm7 - V7/IV. The last bar is a ii-V into IV, which is
    // why it loops back onto the opening FM7 so smoothly.
    chords: [
      { offset: 5, suffix: 'maj7', function: 'subdominant', degreeLabel: 'IVmaj7', durationBeats: 4 },
      { offset: 4, suffix: '7', function: 'dominant', degreeLabel: 'V7/vi', durationBeats: 4 },
      { offset: 9, suffix: 'm7', function: 'tonic', degreeLabel: 'vim7', durationBeats: 4 },
      { offset: 7, suffix: 'm7', function: 'dominant', degreeLabel: 'vm7', durationBeats: 2 },
      { offset: 0, suffix: '7', function: 'dominant', degreeLabel: 'V7/IV', durationBeats: 2 },
    ],
  },
  {
    id: 'city-pop',
    name: 'シティポップ循環',
    category: 'pro',
    chordsDisplay: 'Dm7 · G7 · Em7 · A7',
    tags: ['爽やか', '夜景', '循環'],
    accent: '#22c55e',
    // iim7 - V7 - iiim7 - V7/ii: descending fifths that land back on the opening Dm7.
    chords: [
      { offset: 2, suffix: 'm7', function: 'subdominant', degreeLabel: 'iim7', durationBeats: 4 },
      { offset: 7, suffix: '7', function: 'dominant', degreeLabel: 'V7', durationBeats: 4 },
      { offset: 4, suffix: 'm7', function: 'tonic', degreeLabel: 'iiim7', durationBeats: 4 },
      { offset: 9, suffix: '7', function: 'dominant', degreeLabel: 'V7/ii', durationBeats: 4 },
    ],
  },
  {
    id: 'borrowed-ballad',
    name: '泣きの借用',
    category: 'pro',
    chordsDisplay: 'C · B♭ · Fm · C',
    tags: ['泣き', 'バラード', '借用和音'],
    accent: '#ef4444',
    // I - ♭VII - IVm - I, both colour chords borrowed from the parallel minor.
    chords: [
      { offset: 0, suffix: '', function: 'tonic', degreeLabel: 'I', durationBeats: 4 },
      { offset: 10, suffix: '', function: 'subdominant', degreeLabel: '♭VII', durationBeats: 4 },
      { offset: 5, suffix: 'm', function: 'subdominant', degreeLabel: 'IVm', durationBeats: 4 },
      { offset: 0, suffix: '', function: 'tonic', degreeLabel: 'I', durationBeats: 4 },
    ],
  },
  {
    id: 'descending-bass',
    name: '下降ベースライン',
    category: 'pro',
    chordsDisplay: 'C · G/B · Am · Am/G · F · C/E · Dm7 · G7',
    tags: ['オンコード', '感動的', '半小節'],
    accent: '#eab308',
    // A stepwise bass walk C-B-A-G-F-E-D-G built from slash chords, two beats each.
    chords: [
      { offset: 0, suffix: '', function: 'tonic', degreeLabel: 'I', durationBeats: 2 },
      { offset: 7, suffix: '', function: 'dominant', degreeLabel: 'V', durationBeats: 2, bassOffset: 11 },
      { offset: 9, suffix: 'm', function: 'tonic', degreeLabel: 'vi', durationBeats: 2 },
      { offset: 9, suffix: 'm', function: 'tonic', degreeLabel: 'vi', durationBeats: 2, bassOffset: 7 },
      { offset: 5, suffix: '', function: 'subdominant', degreeLabel: 'IV', durationBeats: 2 },
      { offset: 0, suffix: '', function: 'tonic', degreeLabel: 'I', durationBeats: 2, bassOffset: 4 },
      { offset: 2, suffix: 'm7', function: 'subdominant', degreeLabel: 'iim7', durationBeats: 2 },
      { offset: 7, suffix: '7', function: 'dominant', degreeLabel: 'V7', durationBeats: 2 },
    ],
  },
];

/**
 * Starter progression used to seed a NEW session / the first-launch demo — this is
 * NOT part of the catalog above, it only keeps "新しい進行を作る" playable
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
