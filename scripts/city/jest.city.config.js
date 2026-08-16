/**
 * Isolated runner for City source forensics and offline PoC generation.
 * Harness files never run in the app or the default Jest suite.
 */
module.exports = {
  preset: 'jest-expo',
  rootDir: '../..',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/scripts/city/*.harness.ts'],
};
