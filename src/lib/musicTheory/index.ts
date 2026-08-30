/**
 * Music theory database, structured from 養父 貴『ギターで覚える音楽理論』.
 *
 * Pure data and pure functions. No dependency on React Native, Expo, or any Chord Palette
 * runtime module, so nothing here can affect playback by being imported.
 *
 * Book-derived theory and Chord Palette policy are separated at the type level — see
 * `provenance.ts`. Read `docs/music_theory/chord-palette-theory-db-v0.1.md` for the scope
 * of v0.1 and what it deliberately leaves undecided.
 */

export * from './appPolicy';
export * from './advancedPalette';
export * from './chordFormulas';
export * from './degrees';
export * from './diatonic';
export * from './diminished';
export * from './dominants';
export * from './functions';
export * from './progressions';
export * from './provenance';
export * from './scales';
export * from './slashChords';
export * from './tensions';
export * from './theoryDb';
export * from './voicingRules';
