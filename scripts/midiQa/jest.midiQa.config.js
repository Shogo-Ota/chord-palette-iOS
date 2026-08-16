/**
 * Runner for the MIDI QA harness (`npm run midi:qa`).
 * Same aliases as the app test suite so generation goes through production code.
 */
module.exports = {
  preset: 'jest-expo',
  rootDir: '../..',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/scripts/midiQa/*.harness.ts'],
  testTimeout: 120000,
};
